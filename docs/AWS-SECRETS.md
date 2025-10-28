# AWS Secrets Manager Setup

## 1. Pre-requisitos
- Cuenta AWS activa (ya creada).
- Usuario IAM o rol con permisos para usar Secrets Manager.
- Lista de variables de entorno que quieres guardar (usa `deployment/env/*.template`).

## 2. Crear un secreto para el backend
1. Entra a tu consola de AWS → Secrets Manager → **Store a new secret**.
2. Selecciona **Other type of secret** (key/value pairs).
3. Añade las claves: por ejemplo `MONGO_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `TENANT_PRO_UPLOADS_KEY`, etc.
4. Ponle un nombre fácil de reconocer, por ejemplo `prod/rentalapp/backend` o `staging/rentalapp/backend`.
5. Opcional: define rotación automática para contraseñas (Mongo, SMTP, etc.).
6. Guarda el secreto. Apunta el ARN o el nombre; úsalo en la variable `AWS_SECRETS_ID` (por ejemplo `staging/rentalapp/backend`) y anota la región (`AWS_SECRETS_REGION`).

Repite lo mismo para staging (o crea uno por entorno). También puedes partir el secreto en dos: uno para backend y otro para frontend si quieres separar accesos.

## 3. Guardar las variables del frontend
- Crea otro secreto, p. ej. `prod/rentalapp/frontend`, con claves `REACT_APP_API_URL`, `REACT_APP_STRIPE_PUBLISHABLE_KEY`, etc.
- También podrías usar SSM Parameter Store, pero mantener secretos en un solo sitio simplifica.

## 4. Acceder a los secretos desde la aplicación
Tienes varias opciones:

### 4.1 Cargar en el server (Node.js)
- Instala el SDK AWS (`npm install aws-sdk` o usa la v3 `@aws-sdk/client-secrets-manager`).
- Crea un pequeño script al arrancar que lea los secretos y los ponga en `process.env` antes de iniciar Express.
- Guarda credenciales mediante IAM roles (si usas ECS/EKS/EC2) para evitar claves fijas.

Ejemplo simple usando v3:
```ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'eu-west-1' });
const secret = await client.send(new GetSecretValueCommand({ SecretId: 'prod/rentalapp/backend' }));
if (secret.SecretString) {
  const parsed = JSON.parse(secret.SecretString);
  Object.assign(process.env, parsed);
}
```
Haz esto antes de cargar tu app (`src/app.ts`).

### 4.2 A través del pipeline CI/CD
- En tu sistema de despliegue (GitHub Actions, Jenkins, etc.) usa el paso “Retrieve secret from Secrets Manager” para poblar variables de entorno antes de correr `npm run build` o `npm run start`.
- AWS proporciona acciones y scripts ready-made.

Ejemplo (GitHub Actions):
```yaml
- name: Retrieve secrets
  uses: aws-actions/aws-secretsmanager-get-secrets@v2
  with:
    secret-ids: prod/rentalapp/backend
  env:
    AWS_REGION: eu-west-1
```
Luego tus jobs tendrán variables de entorno disponibles.

### 4.3 Frontend (React)
- Normalmente compilas el frontend con las variables ya presentes. Así que en CI, antes de `npm run build --prefix frontend`, exporta `REACT_APP_*` obtenidos del secreto `prod/rentalapp/frontend`.
- Si usas un distribuidor como Amplify, Vercel o Netlify, también puedes pegar ahí las variables manualmente en su panel.

## 5. Configurar IAM y accesos
- Crea un rol IAM para tu servidor (ECS/EKS/EC2) con permiso `secretsmanager:GetSecretValue` sobre los secretos que necesite.
- No pongas claves AWS en los `.env`; usa el rol asociado al contenedor/instancia.
- Para CI/CD, define un usuario/rol con permiso limitado a `GetSecretValue`.

## 6. Actualizar / Rotar
- Puedes editar el secreto en AWS y actualizar valores sin tocar código.
- Si hay rotación automática (p. ej. para la base de datos) asegúrate de que la app vuelva a leer el secreto al arrancar.
- Para cambios en Stripe/Twilio manuales, actualiza primero en staging, prueba, luego replica en producción.

## 7. Troubleshooting
- **AccessDeniedException**: verifica que el rol/usuario tenga permiso `secretsmanager:GetSecretValue`.
- **MissingSecretValue**: asegúrate de que el nombre (`SecretId`) coincida exactamente con el creado en AWS.
- **No region**: establece `AWS_REGION` en el entorno o al inicializar el cliente.

Con esto la app tendrá sus claves centralizadas y podrás gestionarlas sin exponerlas en código fuente.
