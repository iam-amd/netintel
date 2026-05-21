import { normalizeCustomer, requiredColumns, scoreCustomer, type ScoredCustomer } from "./modelScorer";

export type CsvResult = {
  rows: ScoredCustomer[];
  errors: string[];
};

function parseLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

export function parseAndScoreCsv(text: string): CsvResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [], errors: ["CSV must include a header row and at least one customer row."] };
  }

  const headers = parseLine(lines[0]).map((header) => header.trim());
  const missing = requiredColumns.filter((column) => column !== "customer_id" && !headers.includes(column));
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required columns: ${missing.join(", ")}`] };
  }

  const rows: ScoredCustomer[] = [];
  const errors: string[] = [];

  for (const [lineIndex, line] of lines.slice(1).entries()) {
    const values = parseLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((header, index) => {
      raw[header] = values[index] ?? "";
    });

    try {
      rows.push(scoreCustomer(normalizeCustomer(raw)));
    } catch (error) {
      errors.push(`Row ${lineIndex + 2}: ${error instanceof Error ? error.message : "Could not score row"}`);
    }
  }

  return { rows, errors };
}
