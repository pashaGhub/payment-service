import 'dotenv/config';
import { app } from './app';
import { migrate } from './db/migrate';

const port = Number(process.env.PORT ?? 3000);

migrate()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    })
    .catch((err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
