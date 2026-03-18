export const config = {
    runtime: 'edge', // Cambiamos a Edge Runtime para evitar el límite estricto de 10s de arranque en frío
};

export default async function handler(req) {
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
            try {
                // Timeout manual para rechazar si Google Drive se demora mas de 8s (Edge limite es más alto, pero es mejor prevenir)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8500);
                
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    console.error(`Error HTTP hoja ${key}. Status: ${response.status}`);
                    return { key, data: "" }; // Fallback
                }
                const textData = await response.text();
                return { key, data: textData };
            } catch (err) {
                console.error(`Timeout o error de red en hoja ${key}`, err);
                return { key, data: "" }; // Fallback silencioso para no romper todo
            }
        });

        const results = await Promise.all(fetchPromises);

        const payload = {};
        results.forEach(result => {
            payload[result.key] = result.data;
        });

        return new Response(JSON.stringify(payload), {
            status: 200,
            headers: {
                'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            }
        });

    } catch (error) {
        console.error("Error crítico general:", error);
        return new Response(JSON.stringify({ error: "Fallo general interno", details: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
