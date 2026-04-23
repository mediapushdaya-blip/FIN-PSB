import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ExtractedTransaction {
  id: string; // temp id
  tanggal: string;
  deskripsi: string;
  kategori: string;
  nominal: number;
  tipe: 'Masuk' | 'Keluar';
}

export const parseMandiriStatement = async (file: File): Promise<ExtractedTransaction[]> => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = async function () {
      try {
        const typedarray = new Uint8Array(this.result as ArrayBuffer);
        
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const numPages = pdf.numPages;
        
        let fullText = "";

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const strings = textContent.items.map((item: any) => item.str.trim()).filter((s: string) => s.length > 0);
          
          fullText += strings.join(" ") + " \n";
        }
        
        console.log("Extracted PDF Text Sample:", fullText.substring(0, 500));
        
        const result: ExtractedTransaction[] = [];
        
        // HEURISTIC PARSER FOR KOPRA MANDIRI
        // Find all dates using regex like "08 Apr 2026," or "08 Apr 2026"
        const dateRegex = /\d{2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/gi;
        
        // Because "Created 20 Apr 2026," might appear in header, we should be careful.
        // Let's just split by dateRegex. But we need the dates too.
        let match;
        const blocks: { date: string, text: string }[] = [];
        let lastIndex = -1;
        let lastDate = "";

        while ((match = dateRegex.exec(fullText)) !== null) {
          if (lastIndex !== -1) {
            // Check if it's not a header "Created DD MMM YYYY"
            const chunk = fullText.substring(lastIndex, match.index);
            // Validating chunk is not too huge (not a header gap). Usually a transaction is max 1000 chars.
            if (chunk.length < 2000 && lastDate) {
               blocks.push({ date: lastDate, text: chunk });
            }
          }
          lastDate = match[0];
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex !== -1 && lastDate) {
          blocks.push({ date: lastDate, text: fullText.substring(lastIndex) });
        }

        // Process blocks
        blocks.forEach((block, index) => {
           const str = block.text.trim();
           // Remove "For further questions..." footers
           const cleanStr = str.split("For further questions")[0].trim();
           
           if (!cleanStr) return;

           // Parse Date
           // "08 Apr 2026" -> YYYY-MM-DD
           const dateParts = block.date.split(" ");
           if (dateParts.length >= 3) {
             const months: Record<string, string> = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
             const day = dateParts[0].padStart(2, '0');
             const m = months[dateParts[1].toLowerCase()] || '01';
             const year = dateParts[2];
             const yyyymmdd = `${year}-${m}-${day}`;

             // Extract numbers at the end
             // Looks like: "0.00 1,979,038.00 169,043,256.41"
             // Using regex to match money amounts: \d{1,3}(?:,\d{3})*(?:\.\d{2})
             const amountRegex = /(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/g;
             const amounts = [];
             let amtMatch;
             while ((amtMatch = amountRegex.exec(cleanStr)) !== null) {
               amounts.push(amtMatch[0]);
             }

             if (amounts.length >= 3) {
               const debitStr = amounts[amounts.length - 3].replace(/,/g, '');
               const creditStr = amounts[amounts.length - 2].replace(/,/g, '');
               
               const debit = parseFloat(debitStr);
               const credit = parseFloat(creditStr);
               
               let nominal = 0;
               let tipe: 'Masuk' | 'Keluar' = 'Masuk';
               let kategori = 'Pemasukan';
               
               if (credit > 0) {
                 nominal = credit;
                 tipe = 'Masuk';
                 kategori = 'Pemasukan';
               } else if (debit > 0) {
                 nominal = debit;
                 tipe = 'Keluar';
                 kategori = 'Mutasi Keluar';
               }
               
               // The description is everything before the amounts
               let deskripsi = cleanStr;
               amounts.forEach(a => deskripsi = deskripsi.replace(a, ''));
               deskripsi = deskripsi.replace(/,\s*\d{2}:\d{2}:\d{2}/, ''); // Remove Time if attached to date e.g. ", 14:45:37"
               deskripsi = deskripsi.trim().replace(/\s+/g, ' ');

               // Exclude non-transaction header blocks containing "Account Statement" or "Opening Balance"
               if (nominal > 0 && !deskripsi.toLowerCase().includes("opening balance") && !deskripsi.toLowerCase().includes("closing balance")) {
                 result.push({
                   id: `ext_${Date.now()}_${index}`,
                   tanggal: yyyymmdd,
                   deskripsi: deskripsi.substring(0, 150),
                   nominal: nominal,
                   tipe: tipe,
                   kategori: kategori
                 });
               }
             }
           }
        });

        resolve(result);
      } catch (error) {
        console.error("Error parsing PDF:", error);
        reject(error);
      }
    };

    fileReader.onerror = (error) => {
      reject(error);
    };

    fileReader.readAsArrayBuffer(file);
  });
};
