import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getContract, createSignSession } from '../services/contracts';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import SignaturitWidget from '../components/SignaturitWidget';
import { FileCheck, User, ShieldCheck, Download, PenTool } from 'lucide-react';

export default function ContractDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const { push } = useToast();

  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);

  const loadContract = useCallback(async () => {
    try {
      if (!id || !token) return;
      const data = await getContract(token, id);
      setContract(data);
    } catch (e) {
      console.error(e);
      push({ title: 'Error al cargar contrato', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, token, push]);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  const handleStartSigning = async () => {
    if (!contract) return;
    setIsSigning(true);
    try {
      const { signingUrl } = await createSignSession(contract._id);
      if (!signingUrl) throw new Error('No se recibió URL de firma');
      setSigningUrl(signingUrl);
    } catch (error) {
      console.error(error);
      push({ title: 'Error al iniciar firma segura', tone: 'error' });
      setIsSigning(false);
    }
  };

  const handleSignedSuccess = () => {
    setIsSigning(false);
    setSigningUrl(null);
    push({ title: '¡Documento firmado correctamente!', tone: 'success' });
    loadContract();
  };

  if (loading) return <div className="p-8 text-center">Cargando contrato...</div>;
  if (!contract) return <div className="p-8 text-center text-red-500">Contrato no encontrado</div>;

  const isTenant = user?.role === 'tenant';
  const needsMySignature = isTenant && contract.status === 'pending_signature';
  const isActive = contract.status === 'active';

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
        isActive ? 'bg-green-50 border-green-200' : 'bg-indigo-50 border-indigo-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isActive ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'
          }`}>
            {isActive ? <ShieldCheck size={24} /> : <FileCheck size={24} />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isActive ? 'Contrato Legalizado y Activo' : 'Pendiente de Firma'}
            </h1>
            <p className="text-sm text-gray-600">ID Referencia: {contract._id?.slice(-6).toUpperCase()}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex items-center gap-2">
            <Download size={16} /> Descargar Borrador
          </Button>
          {needsMySignature && (
            <Button
              onClick={handleStartSigning}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center gap-2"
            >
              <PenTool size={18} /> Firmar con Signaturit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <Card>
            <h3 className="font-bold text-gray-400 text-xs uppercase mb-4 tracking-wider">Resumen Económico</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="text-gray-600 text-sm">Renta Mensual</span>
                <span className="font-bold text-lg">{contract.rentAmount} €</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="text-gray-600 text-sm">Fianza</span>
                <span className="font-medium">{contract.depositAmount} €</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-gray-600 text-sm">Duración</span>
                <span className="font-medium text-sm text-right">
                  {new Date(contract.startDate).toLocaleDateString()} <br/> al <br/>
                  {new Date(contract.endDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-bold text-gray-400 text-xs uppercase mb-4 tracking-wider">Intervinientes</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-full"><User size={16} className="text-blue-600"/></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Arrendador</p>
                  <p className="font-medium text-gray-900">{contract.landlordName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                 <div className="bg-green-100 p-2 rounded-full"><User size={16} className="text-green-600"/></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Arrendatario</p>
                  <p className="font-medium text-gray-900">{contract.tenantName}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 min-h-[600px] shadow-inner relative overflow-hidden">
            {!isActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] rotate-[-45deg]">
                <span className="text-9xl font-black uppercase">Borrador</span>
              </div>
            )}

            <div className="max-w-2xl mx-auto bg-white shadow-sm border border-gray-200 p-8 min-h-[800px] text-sm text-gray-800 font-serif leading-relaxed">
              <h2 className="text-center font-bold text-xl uppercase mb-8 border-b pb-4">Contrato de Arrendamiento</h2>
              <p className="mb-4">En {contract.city || 'Madrid'}, a {new Date().toLocaleDateString()}.</p>
              <p className="mb-4">
                <strong>REUNIDOS:</strong><br/>
                De una parte, D./Dña {contract.landlordName} (ARRENDADOR).<br/>
                Y de otra, D./Dña {contract.tenantName} (ARRENDATARIO).
              </p>
              <p className="mb-4">
                <strong>ACUERDAN:</strong><br/>
                El arrendamiento de la finca urbana sita en {contract.propertyAddress || contract.address || 'Dirección'},
                con renta mensual de {contract.rentAmount}€.
              </p>
              <div className="pl-4 border-l-2 border-gray-200 my-6 space-y-2 italic text-gray-600">
                <p>1. Duración: Del {contract.startDate} al {contract.endDate}.</p>
                <p>2. Renta: {contract.rentAmount}€ mensuales pagaderos los primeros 5 días.</p>
                <p>3. Fianza: {contract.depositAmount}€.</p>
                {contract.petsAllowed ? <p>4. Mascotas: Permitidas.</p> : <p>4. Mascotas: No permitidas.</p>}
              </div>
              <div className="mt-12 pt-8 border-t border-gray-300 grid grid-cols-2 gap-8">
                <div className="text-center">
                  <div className="h-16 flex items-end justify-center">
                    <span className="font-handwriting text-xl text-blue-900">{contract.landlordName}</span>
                  </div>
                  <p className="text-xs uppercase font-bold border-t border-gray-300 pt-2">El Arrendador</p>
                </div>
                <div className="text-center relative">
                   {isActive ? (
                     <div className="absolute inset-0 flex items-center justify-center">
                       <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Signature_sample.svg/1200px-Signature_sample.svg.png" className="h-12 opacity-50 -rotate-12" alt="Firma" />
                     </div>
                   ) : (
                     <div className="h-16 flex items-center justify-center text-gray-300 text-xs italic bg-gray-50 border border-dashed border-gray-200 rounded">
                       Espacio para firma certificada
                     </div>
                   )}
                  <p className="text-xs uppercase font-bold border-t border-gray-300 pt-2 relative z-10">El Arrendatario</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={isSigning}
        onClose={() => setIsSigning(false)}
        title="Firma Segura - Signaturit"
        className="max-w-6xl h-[85vh] w-full"
      >
        {signingUrl ? (
          <SignaturitWidget
            signingUrl={signingUrl}
            onSigned={handleSignedSuccess}
            onCancel={() => setIsSigning(false)}
            onError={() => push({ title: 'Error en el widget de firma', tone: 'error' })}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
             <p className="text-gray-500">Conectando con el proveedor de confianza...</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
