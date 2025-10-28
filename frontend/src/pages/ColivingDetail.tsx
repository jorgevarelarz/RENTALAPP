import React from 'react';
import { useParams } from 'react-router-dom';

const ColivingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <h1>Coliving Detail Page</h1>
      <p>Details for coliving space with ID: {id}</p>
      {/* Fetch and display details for the coliving space here */}
    </div>
  );
};

export default ColivingDetail;
