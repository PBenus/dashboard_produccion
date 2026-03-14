export default async function handler(req, res) {
    // URL expuesta del CSV de Google Sheets
    const csvUrl = "https://docs.google.com/spreadsheets/d/127m75upB5IPnxQWN7qMqQIJPi-DTQfdjNM66u9NFGfw/export?format=csv&gid=710295863";

    try {
        // Hacemos la peticion a Google Sheets
        const response = await fetch(csvUrl);
        
        if (!response.ok) {
            throw new Error(`Google Sheets respondió con status ${response.status}`);
        }

        const data = await response.text();

        // Configuración crítica de caché (8 minutos = 480 segundos)
        // - s-maxage=480: Vercel guardará este archivo en caché por 480 segundos en sus servidores mundiales.
        // - stale-while-revalidate=60: Si alguien entra justo después de los 8 min, le sirve la caché vieja instantáneamente, pero actualiza en segundo plano para el siguiente.
        res.setHeader('Cache-Control', 's-maxage=480, stale-while-revalidate=60');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        
        // Devolvemos el CSV plano al frontend
        res.status(200).send(data);
    } catch (error) {
        console.error("Error al obtener los datos de Google Sheets:", error);
        res.status(500).json({ error: "Fallo al obtener los datos de producción", details: error.message });
    }
}
