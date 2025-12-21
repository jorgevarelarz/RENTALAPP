import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export const generateContractPdfFile = (contract: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const filename = `contract-${contract._id || contract.id}.pdf`;
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploadsDir, filename);

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(20).font('Helvetica-Bold').text('CONTRATO DE ARRENDAMIENTO', { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(12).font('Helvetica').text(`En ${contract.city || 'la ciudad'}, a ${new Date().toLocaleDateString()}`);
      doc.moveDown();

      doc.font('Helvetica-Bold').text('REUNIDOS');
      doc.font('Helvetica').text(`De una parte, ${contract.landlordName || 'Propietario'}, con DNI ${contract.landlordIdDoc || '---'} (ARRENDADOR).`);
      doc.text(`Y de otra, ${contract.tenantName || 'Inquilino'}, con DNI ${contract.tenantIdDoc || '---'} (ARRENDATARIO).`);
      doc.moveDown();

      doc.font('Helvetica-Bold').text('ACUERDAN');
      doc.font('Helvetica').text('El arrendamiento de la vivienda con las siguientes condiciones:');
      doc.moveDown();

      const items = [
        `Dirección: ${contract.propertyAddress || contract.address || '---'}`,
        `Duración: Del ${new Date(contract.startDate).toLocaleDateString()} al ${new Date(contract.endDate).toLocaleDateString()}`,
        `Renta Mensual: ${contract.rentAmount || contract.rent} Euros`,
        `Fianza: ${contract.depositAmount || contract.deposit} Euros`,
        `Mascotas: ${contract.petsAllowed ? 'Permitidas' : 'No permitidas'}`,
      ];

      items.forEach((item, i) => {
        doc.text(`${i + 1}. ${item}`);
      });

      doc.moveDown(2);
      doc.text('Y para que conste, firman el presente documento.', { align: 'center' });

      doc.moveDown(4);
      doc.text('__________________________', { align: 'right' });
      doc.text('Fdo: El Arrendatario', { align: 'right' });

      doc.end();

      stream.on('finish', () => resolve(filePath));
      stream.on('error', (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });
};
