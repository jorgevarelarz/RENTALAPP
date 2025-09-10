import React, { useEffect, useState } from 'react';
import { listProperties } from '../services/properties';
import { Link } from 'react-router-dom';

const PropertyList: React.FC = () => {
  const [properties, setProperties] = useState<any[]>([]);
  useEffect(() => {
    listProperties().then(setProperties);
  }, []);
  return (
    <div>
      <h1>Propiedades</h1>
      <ul>
        {properties.map(p => (
          <li key={p._id}>
            <Link to={`/p/${p._id}`}>{p.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PropertyList;
