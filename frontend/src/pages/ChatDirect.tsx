import React from 'react';
import { Link, useParams } from 'react-router-dom';
import ChatPanel from '../components/ChatPanel';

export default function ChatDirectPage() {
  const { userId } = useParams();

  if (!userId) {
    return <div className="p-6 text-sm text-gray-500">Conversacion no disponible.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Link to="/inbox" className="text-sm text-gray-600 hover:text-gray-900">← Volver</Link>
      </div>
      <div className="h-[700px]">
        <ChatPanel kind="direct" refId={userId} />
      </div>
    </div>
  );
}
