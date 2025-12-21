import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import { TrendingUp, DollarSign, Calendar, ArrowUpRight, Wallet, DownloadCloud } from 'lucide-react';
import Button from '../components/ui/Button';

const API_URL = process.env.REACT_APP_API_URL || (import.meta as any).env?.VITE_API_URL || '/api';

export default function Earnings() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (token) {
      loadEarnings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadEarnings = async () => {
    try {
      const res = await axios.get(`${API_URL}/contracts/earnings/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!token) return;
    try {
      setExporting(true);
      const response = await axios.get(`${API_URL}/contracts/earnings/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reporte-RentalApp-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error descargando reporte', e);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Calculando rendimientos...</div>;

  const chartData = data?.chart || [];
  const maxVal = Math.max(...chartData.map((d: any) => d.amount), 100);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rendimiento Financiero</h1>
          <p className="text-gray-500 mt-1">Resumen de ingresos por alquileres activos.</p>
        </div>
        <div className="flex gap-3 items-center">
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            {exporting ? 'Generando...' : (
              <>
                <DownloadCloud size={18} />
                <span>Descargar Informe CSV</span>
              </>
            )}
          </Button>
          <div className="bg-green-50 text-green-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-green-100 hidden md:flex">
            <TrendingUp size={20} />
            <span>Cartera Saludable</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-200">
          <div className="flex items-center gap-3 mb-4 opacity-90">
            <div className="p-2 bg-white/20 rounded-lg">
              <Wallet size={20} />
            </div>
            <span className="font-medium text-sm">Ingresos Totales</span>
          </div>
          <p className="text-4xl font-bold mb-1">{(data?.totalEarnings || 0).toLocaleString()} €</p>
          <p className="text-sm opacity-75 text-blue-100">+ {data?.totalTransactions || 0} transacciones procesadas</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2 text-gray-500">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Calendar size={20} />
            </div>
            <span className="font-medium text-sm">Este Mes</span>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{(data?.monthEarnings || 0).toLocaleString()} €</p>
            <div className="flex items-center gap-1 text-green-600 text-sm mt-1 font-medium">
              <ArrowUpRight size={16} /> 100% cobrado
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2 text-gray-500">
            <div className="p-2 bg-gray-100 rounded-lg">
              <DollarSign size={20} />
            </div>
            <span className="font-medium text-sm">Rentabilidad Media</span>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">~5.4%</p>
            <p className="text-gray-400 text-xs mt-1">Estimación basada en mercado</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 p-6 flex flex-col min-h-[400px]">
          <h3 className="font-bold text-gray-800 mb-8">Evolución de Ingresos (6 Meses)</h3>

          <div className="flex-1 flex items-end justify-between gap-4 px-4 pb-4 border-b border-gray-100">
            {chartData.length === 0 ? (
              <div className="w-full text-center text-gray-400 py-10">Aún no hay suficientes datos para la gráfica.</div>
            ) : (
              chartData.map((item: any, i: number) => {
                const heightPercent = Math.round((item.amount / maxVal) * 100);
                return (
                  <div key={i} className="flex flex-col items-center gap-2 group w-full">
                    <div className="relative w-full bg-gray-100 rounded-t-lg h-64 flex items-end overflow-hidden">
                      <div
                        className="w-full bg-blue-600 rounded-t-lg transition-all duration-1000 ease-out group-hover:bg-blue-500 relative"
                        style={{ height: `${heightPercent}%` }}
                      >
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {item.amount} €
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">{item.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-gray-800 mb-4">Actividad Reciente</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">
                    IN
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Cobro de Alquiler</p>
                    <p className="text-xs text-gray-500">Hace {i + 2} días</p>
                  </div>
                </div>
                <span className="font-bold text-gray-900">+850 €</span>
              </div>
            ))}
            <div className="pt-4 mt-2 border-t text-center">
              <button className="text-blue-600 text-sm hover:underline">Ver todo el historial</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
