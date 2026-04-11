import React from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

interface Booking {
  id: string;
  roomId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  room: { number: string; type: string };
}

interface ReservationCalendarProps {
  bookings: Booking[];
}

export const ReservationCalendar: React.FC<ReservationCalendarProps> = ({ bookings }) => {
  const events = bookings.map(b => ({
    id: b.id,
    title: `${b.guestName} (${b.room?.number || '?'})`,
    start: new Date(b.checkIn),
    end: new Date(b.checkOut),
    status: b.status,
    resourceId: b.roomId,
  }));

  const eventStyleGetter = (event: any) => {
    let backgroundColor = '#94a3b8'; // default
    if (event.status === 'confirmed') backgroundColor = '#22c55e';
    else if (event.status === 'checked_in') backgroundColor = 'var(--accent, #ca8a04)';
    else if (event.status === 'cancelled') backgroundColor = '#ef4444';

    return {
      style: {
        backgroundColor,
        borderRadius: '8px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        padding: '2px 6px'
      }
    };
  };

  return (
    <div style={{ height: '600px', width: '100%', background: 'white', padding: '10px', borderRadius: '16px', border: '1px solid var(--border)' }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        defaultView="month"
        views={['month', 'week', 'day']}
        eventPropGetter={eventStyleGetter}
        tooltipAccessor="title"
        style={{ height: '100%', fontFamily: 'inherit' }}
      />
    </div>
  );
};
