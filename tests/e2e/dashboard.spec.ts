import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E Tests', () => {
  test('debería cargar la página principal de Resumen y sus KPIs', async ({ page }) => {
    await page.goto('/');

    // Verificar el título principal
    await expect(page.locator('h1')).toHaveText('Visión General');

    // Verificar que las tarjetas KPI existen y contienen los títulos esperados
    await expect(page.getByText('TASA DE RESOLUCIÓN')).toBeVisible();
    await expect(page.getByText('ÍNDICE DE FRUSTRACIÓN')).toBeVisible();
    await expect(page.getByText('INTENCIONES SIN RESOLVER')).toBeVisible();
    await expect(page.getByText('FLUJOS CRÍTICOS')).toBeVisible();

    // Verificar que la métrica de Churn se inyectó en la tarjeta 4
    await expect(page.getByText(/riesgo de churn/i)).toBeVisible();
  });

  test('debería navegar a la pestaña Flujos y cargar la tabla', async ({ page }) => {
    await page.goto('/flujos');

    // Verificar el encabezado de Flujos
    await expect(page.locator('h1')).toHaveText('Flujos conversacionales');

    // Verificar las columnas de la tabla
    await expect(page.getByText('Resolución', { exact: true })).toBeVisible();
    await expect(page.getByText('Frustración', { exact: true })).toBeVisible();
    await expect(page.getByText('Abandono', { exact: true })).toBeVisible();
    await expect(page.getByText('Severidad', { exact: true })).toBeVisible();
  });

  test('debería navegar a la pestaña Intenciones y cargar las tarjetas dinámicas', async ({ page }) => {
    await page.goto('/intenciones');

    // Verificar el encabezado
    await expect(page.locator('h1')).toHaveText('Intenciones sin resolver');

    // Verificar los KPIs de Intenciones
    await expect(page.getByText('MENSAJES EN ESTAS INTENCIONES')).toBeVisible();
    await expect(page.getByText('TASA DE RESOLUCIÓN')).toBeVisible();
    await expect(page.getByText('CRÍTICAS')).toBeVisible();
  });
});
