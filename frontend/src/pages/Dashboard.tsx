import React from "react";

interface DashboardProps{
    token: string;
}

const Dashboard: React.FC<DashboardProps> = ({token}) => {
    return (
        <div>
            <h1>Bienvenido al dashboard</h1>
            <p>Tu token JWT: {token}</p>
        </div>
    );
};

export default Dashboard;