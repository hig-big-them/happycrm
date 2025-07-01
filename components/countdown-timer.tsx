"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
  deadline: string;
  showExpiredMessage?: boolean;
  className?: string;
}

export default function CountdownTimer({ 
  deadline, 
  showExpiredMessage = false,
  className = ""
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const deadlineTime = new Date(deadline).getTime();
      const difference = deadlineTime - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        if (days > 0) {
          setTimeLeft(`${days}g ${hours}s ${minutes}d`);
        } else if (hours > 0) {
          setTimeLeft(`${hours}s ${minutes}d`);
        } else if (minutes > 0) {
          setTimeLeft(`${minutes}d ${seconds}s`);
        } else {
          setTimeLeft(`${seconds}s`);
        }
        setIsExpired(false);
      } else {
        setIsExpired(true);
        if (showExpiredMessage) {
          setTimeLeft("Süre doldu!");
        } else {
          setTimeLeft("--:--");
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [deadline, showExpiredMessage]);

  return (
    <span className={`${className} ${isExpired ? 'text-red-600 font-bold' : ''}`}>
      {timeLeft}
    </span>
  );
}