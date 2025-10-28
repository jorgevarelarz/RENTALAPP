import React, { useEffect, useState } from 'react';
import { listColivings } from '../api/coliving'; // This service will be created next
import { Link } from 'react-router-dom';

const ColivingList: React.FC = () => {
  const [colivings, setColivings] = useState<any[]>([]);

  useEffect(() => {
    listColivings().then(setColivings).catch(err => console.error("Failed to fetch colivings:", err));
  }, []);

  return (
    <div>
      <h1>Espacios de Coliving</h1>
      <ul>
        {colivings.map(c => (
          <li key={c._id}>
            {/* The link will eventually go to a detail page, e.g., /coliving/${c._id} */}
            <Link to={`/coliving/${c._id}`}>{c.title}</Link>
            <p>{c.address}</p>
            <p>Renta Mensual: ${c.monthlyRent}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ColivingList;
