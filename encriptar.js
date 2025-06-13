const crypto = require('crypto');

// Clave de 32 bytes para AES-256
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '897fc3faa26fabf29366ee5cd9b26744212f05c4ebefefed447980d77107bf15'; // Usa una clave segura y guárdala en tu entorno
const IV_LENGTH = 16; // Longitud del IV (vector de inicialización)

// Función para cifrar
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH); // Genera un IV aleatorio
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted; // Retorna el IV concatenado con el texto cifrado
}

// Función para descifrar
function decrypt(encryptedText) {
  const [iv, encrypted] = encryptedText.split(':'); // Divide el IV del texto cifrado
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt, ENCRYPTION_KEY };