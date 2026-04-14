// Utility functions for exporting data to CSV

export function downloadCSV(data: any[], filename: string, headers?: { [key: string]: string }) {
  if (!data || data.length === 0) {
    return;
  }

  // Get headers from first object if not provided
  const keys = Object.keys(data[0]);
  const headerRow = headers 
    ? keys.map(key => headers[key] || key).join(',')
    : keys.join(',');

  // Convert data to CSV rows
  const rows = data.map(item => {
    return keys.map(key => {
      let value = item[key];
      
      // Handle nested objects (e.g., companies.name)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        value = Object.values(value).join(' ');
      }
      
      // Handle null/undefined
      if (value === null || value === undefined) {
        value = '';
      }
      
      // Escape quotes and wrap in quotes if contains comma
      value = String(value).replace(/"/g, '""');
      if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        value = `"${value}"`;
      }
      
      return value;
    }).join(',');
  });

  // Combine header and rows
  const csv = [headerRow, ...rows].join('\n');

  // Create blob and download
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function formatDateForExport(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU');
}

export function formatCurrencyForExport(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0';
  return amount.toString();
}
