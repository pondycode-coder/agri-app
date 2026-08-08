import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Grid } from '@/components/ui/grid';
import { useI18n } from '@/context/I18nProvider';

export default function Dashboard() {
  const { t } = useI18n();

  return (
    <MainLayout>
      <h1 className="mb-6 text-2xl font-bold">{t('dashboard.title')}</h1>
      <Grid cols={1} smCols={2} lgCols={3} gap={6}>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.totalFarms')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.totalPlots')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.activeCropCycles')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.totalWorkers')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.pendingTasks')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.inventoryValue')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-3xl font-bold">0 FCFA</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.monthlyIncome')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-3xl font-bold">0 FCFA</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.monthlyExpenses')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-3xl font-bold">0 FCFA</p>
          </CardContent>
        </Card>
      </Grid>
    </MainLayout>
  );
}