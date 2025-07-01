export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul'
  });
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// UTC zamanını Türkiye saatine çevir (debugging için)
export function convertUTCToTurkishTime(utcDateString: string): Date {
  const utcDate = new Date(utcDateString);
  return new Date(utcDate.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
}

// Türkiye saatini UTC'ye çevir (form submission için)
export function convertTurkishTimeToUTC(localDateString: string): Date {
  // Türkiye timezone'ında girilen saati UTC'ye çevir
  const turkishDate = new Date(localDateString);
  return new Date(turkishDate.getTime() - (3 * 60 * 60 * 1000)); // UTC+3 için 3 saat çıkar
}