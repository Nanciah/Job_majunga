// src/services/geocodeService.js
const fetch = require('node-fetch');

/**
 * Convertit une adresse en coordonnées GPS (latitude, longitude)
 * Utilise l'API gratuite Nominatim (OpenStreetMap)
 * @param {string} address - Adresse à géocoder (ex: "Antananarivo, Madagascar")
 * @returns {Promise<{lat: number|null, lng: number|null, display_name: string|null}>}
 */
async function geocodeAddress(address) {
  if (!address || address.trim() === '') {
    return { lat: null, lng: null, display_name: null };
  }

  try {
    // Encoder l'adresse pour l'URL
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&addressdetails=1`;
    
    console.log(`🌍 Géocodage de l'adresse: "${address}"`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'JobMajunga/1.0 (contact@jobmajunga.com)' // Important pour respecter les règles
      }
    });
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };
      console.log(`✅ Géocodage réussi: ${result.lat}, ${result.lng}`);
      return result;
    }
    
    console.log(`⚠️ Aucun résultat pour l'adresse: "${address}"`);
    return { lat: null, lng: null, display_name: null };
  } catch (error) {
    console.error('❌ Erreur géocodage:', error.message);
    return { lat: null, lng: null, display_name: null };
  }
}

/**
 * Pour tester plusieurs adresses (avec délai entre chaque requête)
 * @param {string[]} addresses - Liste d'adresses
 * @returns {Promise<Array>}
 */
async function geocodeBatch(addresses) {
  const results = [];
  for (const address of addresses) {
    // Pause de 1s pour respecter la limite de l'API (1 requête/seconde)
    await new Promise(resolve => setTimeout(resolve, 1000));
    const coords = await geocodeAddress(address);
    results.push({ address, ...coords });
  }
  return results;
}

module.exports = { geocodeAddress, geocodeBatch };