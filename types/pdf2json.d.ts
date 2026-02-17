declare module "pdf2json" {
    import { EventEmitter } from "events";

    interface PDFData {
        Pages: unknown[];
        Meta: Record<string, unknown>;
    }

    export default class PDFParser extends EventEmitter {
        constructor(context?: unknown, needRawText?: number);
        parseBuffer(buffer: Buffer | Uint8Array): void;
        getRawTextContent(): string;
        loadPDF(pdfFilePath: string): void;
        on(event: "pdfParser_dataReady", listener: (pdfData: PDFData) => void): this;
        on(event: "pdfParser_dataError", listener: (errData: { parserError: string | Error }) => void): this;
    }
}