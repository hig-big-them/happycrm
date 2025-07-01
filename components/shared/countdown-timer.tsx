"use client";

import React, { useEffect, useState } from 'react';
import { Badge } from '../ui/badge';

interface CountdownTimerProps {
  deadline: string | null;
  status: string | null;
  onDeadlinePass?: () => void; // Opsiyonel callback
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(deadlineISO: string | null): TimeLeft | null {
  if (!deadlineISO) return null;
  
  const difference = +new Date(deadlineISO) - +new Date();
  if (difference <= 0) {
    return null;
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

export function CountdownTimer({ deadline, status, onDeadlinePass }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => calculateTimeLeft(deadline));
  const [hasDeadlinePassed, setHasDeadlinePassed] = useState(
    deadline ? +new Date(deadline) - +new Date() <= 0 : false
  );

  useEffect(() => {
    if (status === 'completed' || status === 'cancelled') {
      setTimeLeft(null);
      return;
    }

    if (!deadline) {
      setTimeLeft(null);
      return;
    }

    if (hasDeadlinePassed) {
        setTimeLeft(null);
        if (onDeadlinePass && status !== 'delayed') { // Durum zaten gecikmiş değilse çağır
             // onDeadlinePass(); // Şimdilik bu özelliği aktif etmiyoruz
        }
        return;
    }

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(deadline);
      if (newTimeLeft) {
        setTimeLeft(newTimeLeft);
      } else {
        setTimeLeft(null);
        setHasDeadlinePassed(true);
        clearInterval(timer);
        if (onDeadlinePass && status !== 'delayed') {
            // onDeadlinePass(); // Şimdilik bu özelliği aktif etmiyoruz
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline, status, hasDeadlinePassed, onDeadlinePass]);

  if (status === 'completed' || status === 'cancelled') {
    return <span className="text-sm text-gray-500">-</span>;
  }

  if (!deadline) {
    return <span className="text-sm text-gray-500">Deadline Yok</span>;
  }

  if (hasDeadlinePassed) {
    return <Badge variant="destructive">Deadline Geçti</Badge>;
  }

  if (!timeLeft) {
    // İlk renderda veya deadline geçtiğinde ama henüz state güncellenmediğinde
    // veya tamamlandı/iptal edildi durumlarında buraya düşebilir.
    // `hasDeadlinePassed` kontrolü yukarıda olduğu için, burası genellikle ilk render.
    return <span className="text-sm text-gray-500">Yükleniyor...</span>;
  }
  
  const { days, hours, minutes, seconds } = timeLeft;

  // Renklendirme için mantık (örneğin son 1 saat kala kırmızı)
  const isCritical = days === 0 && hours < 1; 
  const textColor = isCritical ? 'text-red-500 font-semibold' : 'text-gray-700 dark:text-gray-300';

  return (
    <div className={`text-sm ${textColor}`}>
      {days > 0 && <span>{days}g </span>}
      {hours > 0 && <span>{hours}s </span>}
      {minutes > 0 && <span>{minutes}d </span>}
      {(days === 0 && hours === 0 && minutes < 5) || (days === 0 && hours === 0 && minutes === 0 && seconds >=0) ? <span>{seconds}sn</span> : (minutes === 0 && hours === 0 && days === 0) ? null : <span>{seconds}sn</span>}
      {(days === 0 && hours === 0 && minutes === 0 && seconds === 0 && !hasDeadlinePassed) && <span className="text-sm text-gray-500">Şimdi</span>}
    </div>
  );
} 