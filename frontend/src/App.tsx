import React, { useState } from 'react';
import Login from './componets/Login';
import Dashboard from './pages/Dashboard';

function App() {
  const [token, setToken] = useState<string|null>(null);

  return (
    <div>
      {!token ? ( <Login onLoginSucces={setToken}/>) : (<Dashboard token={token}/>)}
    </div>
  );
}

export default App;
