"use client";

import { useTheme } from "../context/theme-context";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SankeyNode = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type SankeyLink = {
  source: string;
  target: string;
  value: number;
};

export type SankeyData = {
  nodes: SankeyNode[];
  links: SankeyLink[];
};

// ─── Layout Engine ────────────────────────────────────────────────────────────

type LayoutNode = SankeyNode & {
  x: number;
  y: number;
  height: number;
  column: number;
};

type LayoutLink = SankeyLink & {
  sourceY: number;
  targetY: number;
  sourceX: number;
  targetX: number;
  thickness: number;
  color: string;
};

function computeLayout(
  data: SankeyData,
  width: number,
  height: number,
  nodeWidth: number = 16,
  nodePadding: number = 12,
): { nodes: LayoutNode[]; links: LayoutLink[] } {
  // Group nodes by column (0 = intents, 1 = sentiments, 2 = resolution)
  const columns: Map<number, SankeyNode[]> = new Map();
  const nodeColumnMap: Map<string, number> = new Map();

  // Assign columns based on node id prefix
  data.nodes.forEach((node) => {
    let col = 0;
    if (node.id.startsWith("sent_")) col = 1;
    else if (node.id.startsWith("res_")) col = 2;
    nodeColumnMap.set(node.id, col);
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(node);
  });

  const numCols = columns.size;
  const colWidth = (width - nodeWidth) / Math.max(numCols - 1, 1);

  // Compute total value per column for scaling
  const layoutNodes: Map<string, LayoutNode> = new Map();

  columns.forEach((colNodes, colIdx) => {
    const totalValue = colNodes.reduce((s, n) => s + n.value, 0);
    const availableHeight = height - (colNodes.length - 1) * nodePadding;
    let currentY = 0;

    colNodes.forEach((node) => {
      const nodeHeight = Math.max((node.value / totalValue) * availableHeight, 8);
      layoutNodes.set(node.id, {
        ...node,
        x: colIdx * colWidth,
        y: currentY,
        height: nodeHeight,
        column: colIdx,
      });
      currentY += nodeHeight + nodePadding;
    });
  });

  // Compute links
  const sourceOffsets: Map<string, number> = new Map();
  const targetOffsets: Map<string, number> = new Map();

  const layoutLinks: LayoutLink[] = data.links
    .sort((a, b) => b.value - a.value)
    .map((link) => {
      const source = layoutNodes.get(link.source)!;
      const target = layoutNodes.get(link.target)!;

      if (!source || !target) return null;

      const sourceTotal = data.links
        .filter((l) => l.source === link.source)
        .reduce((s, l) => s + l.value, 0);
      const targetTotal = data.links
        .filter((l) => l.target === link.target)
        .reduce((s, l) => s + l.value, 0);

      const thickness = Math.max((link.value / sourceTotal) * source.height, 2);

      const sOffset = sourceOffsets.get(link.source) || 0;
      const tOffset = targetOffsets.get(link.target) || 0;

      sourceOffsets.set(link.source, sOffset + thickness);
      targetOffsets.set(link.target, tOffset + (link.value / targetTotal) * target.height);

      return {
        ...link,
        sourceX: source.x + nodeWidth,
        targetX: target.x,
        sourceY: source.y + sOffset + thickness / 2,
        targetY: target.y + tOffset + ((link.value / targetTotal) * target.height) / 2,
        thickness,
        color: source.color,
      };
    })
    .filter(Boolean) as LayoutLink[];

  return { nodes: Array.from(layoutNodes.values()), links: layoutLinks };
}

// ─── SVG Path ─────────────────────────────────────────────────────────────────

function LinkPath({ link, opacity }: { link: LayoutLink; opacity: number }) {
  const midX = (link.sourceX + link.targetX) / 2;
  const d = `M ${link.sourceX},${link.sourceY}
    C ${midX},${link.sourceY} ${midX},${link.targetY} ${link.targetX},${link.targetY}`;

  return (
    <path
      d={d}
      fill="none"
      stroke={link.color}
      strokeWidth={Math.max(link.thickness, 1.5)}
      strokeOpacity={opacity}
      style={{ transition: "stroke-opacity 0.2s ease" }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SankeyChart({ data }: { data: SankeyData }) {
  const { colors } = useTheme();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const width = 600;
  const height = 280;
  const nodeWidth = 14;
  const padding = { top: 10, right: 90, bottom: 10, left: 90 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const { nodes, links } = computeLayout(data, innerWidth, innerHeight, nodeWidth);

  // Column labels
  const colLabels = ["Intención", "Sentimiento", "Resultado"];

  return (
    <div
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        padding: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          color: colors.textMuted,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 12,
        }}
      >
        FLUJO DE CONVERSACIONES — INTENCIÓN → SENTIMIENTO → RESOLUCIÓN
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxHeight: 300 }}
      >
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Column headers */}
          {colLabels.map((label, i) => {
            const x = i * ((innerWidth - nodeWidth) / 2);
            return (
              <text
                key={label}
                x={x + nodeWidth / 2}
                y={-2}
                textAnchor="middle"
                fill={colors.textMuted}
                fontSize={9}
                fontWeight={500}
              >
                {label}
              </text>
            );
          })}

          {/* Links */}
          {links.map((link, i) => {
            const isHighlighted =
              hoveredNode === null ||
              hoveredNode === link.source ||
              hoveredNode === link.target;
            return (
              <LinkPath
                key={`${link.source}-${link.target}-${i}`}
                link={link}
                opacity={isHighlighted ? 0.4 : 0.06}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isHighlighted = hoveredNode === null || hoveredNode === node.id;
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={nodeWidth}
                  height={node.height}
                  rx={3}
                  fill={node.color}
                  fillOpacity={isHighlighted ? 1 : 0.3}
                  style={{ transition: "fill-opacity 0.2s ease" }}
                />
                {/* Label */}
                <text
                  x={
                    node.column === 2
                      ? node.x + nodeWidth + 6
                      : node.column === 0
                      ? node.x - 6
                      : node.x + nodeWidth + 6
                  }
                  y={node.y + node.height / 2 + 3}
                  textAnchor={node.column === 0 ? "end" : "start"}
                  fill={isHighlighted ? colors.textPrimary : colors.textMuted}
                  fontSize={10}
                  style={{ transition: "fill 0.2s ease" }}
                >
                  {node.label}
                </text>
                {/* Value */}
                <text
                  x={
                    node.column === 2
                      ? node.x + nodeWidth + 6
                      : node.column === 0
                      ? node.x - 6
                      : node.x + nodeWidth + 6
                  }
                  y={node.y + node.height / 2 + 14}
                  textAnchor={node.column === 0 ? "end" : "start"}
                  fill={colors.textMuted}
                  fontSize={8}
                  opacity={isHighlighted ? 1 : 0.4}
                >
                  {node.value}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
