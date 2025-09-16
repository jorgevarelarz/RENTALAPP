import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

interface GenerateContractPDFOptions {
  contract: {
    _id?: unknown;
    id?: unknown;
    landlord?: unknown;
    tenant?: unknown;
    property?: unknown;
    region?: string;
    rent?: number;
    deposit?: number;
    startDate?: Date | string;
    endDate?: Date | string;
  };
  clausesText: string[];
}

export interface GenerateContractPDFResult {
  absolutePath: string;
  publicPath: string;
}

const CONTRACTS_UPLOAD_DIR = path.join(process.cwd(), "uploads", "contracts");

const formatDate = (value: Date | string | undefined): string => {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().split("T")[0];
};

const ensureDirectory = async (dir: string) => {
  await fs.promises.mkdir(dir, { recursive: true });
};

export async function generateContractPDF({
  contract,
  clausesText,
}: GenerateContractPDFOptions): Promise<GenerateContractPDFResult> {
  await ensureDirectory(CONTRACTS_UPLOAD_DIR);
  const contractId = String(contract._id ?? contract.id ?? "contract");
  const filename = `${contractId}.pdf`;
  const absolutePath = path.join(CONTRACTS_UPLOAD_DIR, filename);
  const publicPath = `/uploads/contracts/${filename}`;

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const writeStream = fs.createWriteStream(absolutePath);
  const finished = new Promise<void>((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  doc.pipe(writeStream);

  const generationDate = formatDate(new Date());
  doc.fontSize(18).text("CONTRATO DE ARRENDAMIENTO DE VIVIENDA", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Generado el ${generationDate}`, { align: "right" });
  doc.moveDown(1);

  doc.fontSize(12).text("DATOS DEL CONTRATO", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Arrendador (ID): ${String(contract.landlord ?? "-" )}`);
  doc.text(`Inquilino (ID): ${String(contract.tenant ?? "-" )}`);
  doc.text(`Propiedad (ID): ${String(contract.property ?? "-" )}`);
  doc.text(`Región: ${contract.region ?? "-"}`);
  doc.text(`Renta mensual: ${contract.rent ?? "-"} €`);
  doc.text(`Depósito: ${contract.deposit ?? "-"} €`);
  doc.text(
    `Vigencia: ${formatDate(contract.startDate) || "-"} - ${formatDate(contract.endDate) || "-"}`,
  );
  doc.moveDown(1);

  doc.fontSize(12).text("CLÁUSULAS", { underline: true });
  doc.moveDown(0.5);
  if (clausesText.length === 0) {
    doc.fontSize(10).text("No se han proporcionado cláusulas adicionales.");
  } else {
    clausesText.forEach((text, index) => {
      doc.fontSize(10).text(`${index + 1}. ${text}`).moveDown(0.5);
    });
  }

  doc.moveDown(2);
  const signatureY = doc.y;
  doc.fontSize(10);
  doc.text("__________________________", 80, signatureY);
  doc.text("__________________________", 320, signatureY);
  doc.text("Arrendador", 80, signatureY + 15);
  doc.text("Inquilino", 320, signatureY + 15);

  doc.end();
  await finished;

  return { absolutePath, publicPath };
}
