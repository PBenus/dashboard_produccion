export default async function handler(req, res) {
    // Definir los URLs de exportación CSV de todos los Google Sheets involucrados
    const sheets = {
        // 1. Archivo Maestro de Producción (Vehículos base)
        master: "https://docs.google.com/spreadsheets/d/127m75upB5IPnxQWN7qMqQIJPi-DTQfdjNM66u9NFGfw/export?format=csv&gid=710295863",
        
        // 2. Drive EMSA/DESPACHO/ASSA
        emsa_entregas: "https://docs.google.com/spreadsheets/d/152otxIaA-PFZvwvgXz9aMtHxK7m_mWebkZNQrbQpdPA/gviz/tq?tqx=out:csv&sheet=Entregas+Otros+Dealers",
        emsa_revision: "https://docs.google.com/spreadsheets/d/152otxIaA-PFZvwvgXz9aMtHxK7m_mWebkZNQrbQpdPA/gviz/tq?tqx=out:csv&sheet=Revision+Otros+Dealers",
        
        // 3. Drive REVO/ESSA
        revo_entregas: "https://docs.google.com/spreadsheets/d/1w56CxJlyztpajgfOVDOfu-Fag2lYOBEfWVylVZRddjc/gviz/tq?tqx=out:csv&sheet=Entregas",
        revo_revision: "https://docs.google.com/spreadsheets/d/1w56CxJlyztpajgfOVDOfu-Fag2lYOBEfWVylVZRddjc/gviz/tq?tqx=out:csv&sheet=Unidades+Revisadas"
    };

    try {
        // Realizar las 5 peticiones HTTP en paralelo para máxima velocidad
        const fetchPromises = Object.entries(sheets).map(async ([key, url]) => {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`Error al obtener hoja ${key}. Status: ${response.status}`);
                return { key, data: "" }; // Fallback preventivo
            }
            const textData = await response.text();
            return { key, data: textData };
        });

        // Esperar a que todos los CSVs terminen de descargar
        const results = await Promise.all(fetchPromises);

        // Agrupar los CSVs en un único objeto JSON
        const payload = {};
        results.forEach(result => {
            payload[result.key] = result.data;
        });

        // Configuración crítica de caché (8 minutos = 480 segundos)
        res.setHeader('Cache-Control', 's-maxage=480, stale-while-revalidate=60');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        // Devolvemos el gran paquete de de datos JSON al frontend
        res.status(200).json(payload);
        
    } catch (error) {
        console.error("Error crítico general al obtener los datos multiplataforma:", error);
        res.status(500).json({ error: "Fallo de conexión múltiple con Google Drive", details: error.message });
    }
}
