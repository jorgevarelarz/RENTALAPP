import React, {useState} from 'react';
import { login } from '../services/auth';
import './style.css';
interface LoginProps{
    onLoginSucces: (token: string) => void;
}

const Login: React.FC<LoginProps> = ({onLoginSucces}) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSumit = async(e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const token = await login(email, password);
            onLoginSucces(token);
        } 
        catch (err: any) {
            setError(err.response?.data?.message || 'Error de login')
        }
    };

    return (

        //Esto es la prueba del principio
        // <form onSubmit={handleSumit}>
        //     <h2>Login</h2>
        //     {error && <p style={{color: 'red'}}>{error}</p>}
        //     <div>
        //         <label>Email:</label>
        //         <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />                
        //     </div>
        //     <div>
        //         <label>Contraseña:</label>
        //         <input type="password" value={password} onChange={e => setPassword(e.target.value)} required/>
        //     </div>

        //     <button type="submit">Entrar</button>
        // </form>
        <html lang='es'>
            <body>
                <div className='container'>
                    <div className='form-box login'>
                        <form action=''>
                            <h1>Login</h1>
                            <div className='input-box'>
                                <input type='text' placeholder='email' required/>
                                <i className='bx bxs-user'></i>
                            </div>
                            <div className='input-box'>
                                <input type='password' placeholder='Contraseña' required/>
                                <i className='bx bxs-lock-alt'></i>
                            </div>
                            <div className='forgot-link'>
                                <a href='#'>Olvidó su contraseña?</a>
                            </div>
                            <button type='submit' className='btn'>Login</button>
                            <p> o login con cuenta google</p>
                            <div className='social-icons'>
                                <a href='#'><i className='bx bxl-google'></i></a>
                            </div>
                        </form>
                    </div>
                </div>
            </body>
        </html>

    );
};

export default Login;

