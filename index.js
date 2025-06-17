require('dotenv').config();
const dotenv = require('dotenv');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const { encrypt, decrypt } = require('./encriptar');
const cors = require('cors');
const mysql = require('mysql2/promise');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const dbConfig = {
    host: '192.168.1.86',
    user: 'lnxarchitect',
    password: 'Practica#4',
    database: 'conectatutor',
};

const pool = mysql.createPool(dbConfig);

(async () => {
    try {
        const conn = await mysql.createConnection(dbConfig);
        console.log('¡Conectado exitosamente!');
        await conn.end();
    } catch (error) {
        console.error('Error al conectar:', error);
    }
})();


// nombre": "Raquel",
//     "apellidos": "Reyes Zapata",
//     "ocupacion": "admin",
//     "password": "1",


app.get('/api-key', (req, res) => {
  try {
    const env = dotenv.parse(fs.readFileSync('./sendgrid_android.env'));
    res.json({ apiKey: env.API_KEY });
  } catch (err) {
    console.error('Error al leer archivo .env:', err);
    res.status(500).json({ error: 'No se pudo cargar API_KEY' });
  }
});

// Obtener todos los usuarios (docentes y alumnos)
app.get('/usuarios', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [docentes] = await connection.execute('SELECT idDocente AS id, Nombre, "tutor" AS ocupacion, CONCAT(ApellidoPaterno, " ", ApellidoMaterno) AS apellidos, Password AS password FROM Docente');
        const [alumnos] = await connection.execute('SELECT idAlumno AS id, Nombre, "alumno" AS ocupacion, CONCAT(ApellidoPaterno, " ", ApellidoMaterno) AS apellidos, Password AS password, Semestre FROM Alumno');
        await connection.end();

        const usuarios = [...docentes, ...alumnos];
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener carrera y materias
app.get('/carrera-materias', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(`
            SELECT Carrera.Nombre AS carrera, Materia.Nombre AS materia
            FROM Carrera
            JOIN Materia ON Carrera.idCarrera = Materia.idCarrera
        `);
        await connection.end();

        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta para cifrar
app.post('/encrypt', (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).send({ error: 'Falta el texto a cifrar' });

    try {
        const encrypted = encrypt(text);
        res.status(200).send({ encrypted });
    } catch {
        res.status(500).send({ error: 'Error al cifrar los datos' });
    }
});

// Ruta para descifrar
app.post('/decrypt', (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).send({ error: 'Falta el texto a descifrar' });

    try {
        const decrypted = decrypt(text);
        res.status(200).send({ decrypted });
    } catch {
        res.status(500).send({ error: 'Error al descifrar los datos' });
    }
});

// Enviar correo
app.post('/send-email', (req, res) => {
    const { to, subject, text, html } = req.body;

    const msg = {
        to,
        from: 'al333812@edu.uaa.mx',
        subject,
        text,
        html,
    };

    sgMail
        .send(msg)
        .then(() => res.status(200).send('Email sent successfully'))
        .catch((error) => {
            console.error(error);
            res.status(500).send('Failed to send email');
        });
});



// Obtener solo asesores (docentes)
app.get('/asesores', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [tutores] = await connection.execute(`
            SELECT idDocente AS id, CONCAT(Nombre, ' ', ApellidoPaterno, ' ', ApellidoMaterno) AS nombre
            FROM Docente
        `);
        await connection.end();

        res.json(tutores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener carreras
app.get('/carreras', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [carreras] = await connection.execute('SELECT * FROM Carrera');
        await connection.end();

        res.json(carreras);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


//Parte2

app.get('/lugares', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM Lugar');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/materia', async (req, res) => {
    const { nombre, idCarrera } = req.body;

    if (!nombre || !idCarrera) {
        return res.status(400).json({ error: 'El nombre y la carrera son obligatorios.' });
    }

    try {
        const [existente] = await pool.query(
            'SELECT * FROM Materia WHERE LOWER(Nombre) = LOWER(?) AND idCarrera = ?',
            [nombre, idCarrera]
        );
        if (existente.length > 0) {
            return res.status(400).json({ error: 'La materia ya existe en el sistema.' });
        }

        const [result] = await pool.query(
            'INSERT INTO Materia (Nombre, idCarrera) VALUES (?, ?)',
            [nombre, idCarrera]
        );

        res.status(201).json({ id: result.insertId, nombre, idCarrera });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/carrera', async (req, res) => {
    const { nombre } = req.body;

    if (!nombre) {
        return res.status(400).json({ error: 'El nombre de la carrera es obligatorio' });
    }

    try {
        const [existente] = await pool.query('SELECT * FROM Carrera WHERE LOWER(Nombre) = LOWER(?)', [nombre]);
        if (existente.length > 0) {
            return res.status(400).json({ error: 'La carrera ya existe en el sistema' });
        }

        const [result] = await pool.query('INSERT INTO Carrera (Nombre) VALUES (?)', [nombre]);

        res.status(201).json({ id: result.insertId, nombre });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//Registro listo
//login con hashes
app.post('/login', async (req, res) => {
  const { id, password } = req.body;

  try {
      const connection = await mysql.createConnection(dbConfig);

      const [docentes] = await connection.execute(
          'SELECT idDocente AS id, Nombre, "tutor" AS ocupacion, Password FROM Docente WHERE idDocente = ?',
          [id]
      );

      const [alumnos] = await connection.execute(
          'SELECT idAlumno AS id, Nombre, "alumno" AS ocupacion, Password FROM Alumno WHERE idAlumno = ?',
          [id]
      );

      await connection.end();

      let usuario = null;
      if (docentes.length > 0) usuario = docentes[0];
      else if (alumnos.length > 0) usuario = alumnos[0];

      if (!usuario) {
          return res.status(401).json({ error: 'Usuario no encontrado.' });
      }

      const match = await bcrypt.compare(password, usuario.Password);

      if (!match) {
          return res.status(401).json({ error: 'Contraseña incorrecta.' });
      }

      return res.status(200).json({
          mensaje: 'Login exitoso',
          usuario: {
              id: usuario.id,
              nombre: usuario.Nombre,
              ocupacion: usuario.ocupacion
          }
      });

  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});


//registro con encriptacion
const bcrypt = require('bcrypt');
const saltRounds = 10;

app.post('/alumnos', async (req, res) => {
    const { id, nombre, apellidoPaterno, apellidoMaterno, idCarrera, password, semestre } = req.body;

    if (!id || !nombre || !apellidoPaterno || !apellidoMaterno || !idCarrera || !password || !semestre) {
        return res.status(400).json({ error: 'Faltan datos obligatorios del alumno.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await pool.query(
            'INSERT INTO Alumno (idAlumno, Nombre, ApellidoPaterno, ApellidoMaterno, idCarrera, Password, Semestre) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, nombre, apellidoPaterno, apellidoMaterno, idCarrera, hashedPassword, semestre]
        );

        res.status(201).json({ mensaje: 'Alumno registrado exitosamente.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/tutores', async (req, res) => {
  const { id, nombre, apellidoPaterno, apellidoMaterno, nivelAcademico, password } = req.body;

  if (!id || !nombre || !apellidoPaterno || !apellidoMaterno || !nivelAcademico || !password) {
      return res.status(400).json({ error: 'Faltan datos obligatorios del tutor.' });
  }

  try {
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      await pool.query(
          'INSERT INTO Docente (idDocente, Nombre, ApellidoPaterno, ApellidoMaterno, NivelAcademico, Password) VALUES (?, ?, ?, ?, ?, ?)',
          [id, nombre, apellidoPaterno, apellidoMaterno, nivelAcademico, hashedPassword]
      );

      res.status(201).json({ mensaje: 'Tutor registrado exitosamente.' });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});


app.get('/usr/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Buscar en ambas tablas
        const [[alumno]] = await pool.query('SELECT idAlumno AS id, Nombre, "alumno" AS ocupacion, CONCAT(ApellidoPaterno, " ", ApellidoMaterno) AS apellidos, Password AS password, Semestre FROM Alumno WHERE idAlumno = ?', [id]);
        if (alumno) return res.json({ ...alumno, ocupacion: 'alumno' });

        const [[docente]] = await pool.query('SELECT idDocente AS id, Nombre, "tutor" AS ocupacion, CONCAT(ApellidoPaterno, " ", ApellidoMaterno) AS apellidos, Password AS password FROM Docente WHERE idDocente = ?', [id]);
        if (docente) return res.json({ ...docente, ocupacion: 'tutor' });

        return res.status(404).json({ error: 'Usuario no encontrado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/materias/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [[alumno]] = await pool.query('SELECT idCarrera FROM Alumno WHERE idAlumno = ?', [id]);

        if (!alumno) {
            return res.status(404).json({ error: 'Alumno no encontrado' });
        }

        const [materias] = await pool.query('SELECT * FROM Materia WHERE idCarrera = ?', [alumno.idCarrera]);
        res.json(materias);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.put('/actualizar-carrera-materias', async (req, res) => {
  const { id_carrera, materias } = req.body;

  if (!id_carrera || !Array.isArray(materias)) {
    return res.status(400).json({ error: 'id_carrera y materias son obligatorios' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Eliminar materias actuales de la carrera
    await connection.query('DELETE FROM Materia WHERE idCarrera = ?', [id_carrera]);

    // Insertar nuevas
    const inserts = materias.map(nombre => connection.query(
      'INSERT INTO Materia (Nombre, idCarrera) VALUES (?, ?)', [nombre, id_carrera]
    ));
    await Promise.all(inserts);

    await connection.commit();
    res.json({ mensaje: 'Materias actualizadas correctamente.' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});


app.put('/usuarios', async (req, res) => {
  const { id, ocupacion, password } = req.body;

  if (!id || !ocupacion || !password) {
    return res.status(400).json({ error: 'ID, ocupación y nueva contraseña son obligatorios.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    if (ocupacion === 'alumno') {
      await pool.query(
        `UPDATE Alumno SET Password = ? WHERE idAlumno = ?`,
        [hashedPassword, id]
      );
    } else if (ocupacion === 'tutor') {
      await pool.query(
        `UPDATE Docente SET Password = ? WHERE idDocente = ?`,
        [hashedPassword, id]
      );
    } else {
      return res.status(400).json({ error: 'Ocupación no válida' });
    }

    res.json({ mensaje: 'Contraseña actualizada exitosamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/materias', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Materia');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/alumnos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT i.idInscripcion, i.idAlumno, i.idAsesoria
      FROM Inscripcion i
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/alumnos/:id_asesoria', async (req, res) => {
  const { id_asesoria } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT a.idAlumno AS id, CONCAT(a.Nombre, ' ', a.ApellidoPaterno, ' ', a.ApellidoMaterno) AS nombreCompleto,
             c.Nombre AS carrera
      FROM Inscripcion i
      JOIN Alumno a ON i.idAlumno = a.idAlumno
      LEFT JOIN Carrera c ON a.idCarrera = c.idCarrera
      WHERE i.idAsesoria = ?
    `, [id_asesoria]);
    if (rows.length === 0) return res.status(404).json({ error: `No hay alumnos inscritos en la asesoría ${id_asesoria}` });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/baja-asesoria', async (req, res) => {
  const { id_asesoria, id_maestro } = req.body;
  if (!id_asesoria || !id_maestro) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  try {
    const [asesoria] = await pool.query(
      'SELECT idDocente FROM Asesoria WHERE idAsesoria = ?', [id_asesoria]
    );
    if (asesoria.length === 0) return res.status(404).json({ error: 'Asesoría no encontrada.' });
    if (asesoria[0].idDocente !== id_maestro) {
      return res.status(403).json({ error: 'No tienes permiso para cancelar esta asesoría.' });
    }

    await pool.query(`
      UPDATE Asesoria
      SET idDocente = NULL, Estado = 'Cancelada'
      WHERE idAsesoria = ?
    `, [id_asesoria]);

    res.json({ mensaje: 'Asesoría cancelada exitosamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


//Obtiene las materias mal, pero x por el momento
app.get('/asesorias', async (req, res) => {
  try {
    const [asesorias] = await pool.query(`
      SELECT a.idAsesoria AS id_asesoria, a.FechaInicio AS fecha_inicio, a.FechaFin AS fecha_fin,
             a.HorarioInicio AS horario_inicio, a.HorarioFin AS horario_fin,
             a.Estado AS estado,
             m.Nombre AS materiaNombre,
             CONCAT(d.Nombre, ' ', d.ApellidoPaterno, ' ', d.ApellidoMaterno) AS maestroNombre,
             l.Nombre AS lugarNombre
      FROM Asesoria a
      LEFT JOIN Materia m ON a.idAsesoria = m.idMateria -- Revisar relación real
      LEFT JOIN Docente d ON a.idDocente = d.idDocente
      LEFT JOIN Lugar l ON a.idLugar = l.idLugar
    `);
    res.json(asesorias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//inicio4
app.get('/asesorias/alumno/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [asesorias] = await pool.query(`
            SELECT 
                a.idAsesoria AS id_asesoria,
                a.FechaInicio AS fecha_inicio, 
                a.FechaFin AS fecha_fin,
                GROUP_CONCAT(d.Dia ORDER BY d.idDia SEPARATOR ', ') AS dias,
                a.HorarioInicio AS horario_inicio, 
                a.HorarioFin AS horario_fin
            FROM Inscripcion i
            JOIN Asesoria a ON a.idAsesoria = i.idAsesoria
            JOIN Asesoria_Dias ad ON ad.IdAsesoria = a.idAsesoria
            JOIN Dias d ON d.idDia = ad.IdDia
            WHERE i.idAlumno = ?
            GROUP BY 
                a.idAsesoria
        `, [id]);

        if (asesorias.length === 0) {
            return res.status(404).json({ error: 'El alumno no tiene asesorías asignadas.' });
        }

        res.json(asesorias);

    } catch (error) {
        console.error('Error al obtener asesorías del alumno:', error);
        res.status(500).json({
            error: 'Error al procesar las asesorías del alumno.',
            detalle: error.message
        });
    }
});



//Falta por implementar: NoSQL para mostrar las asesorias de las materias dependiendo de la carrera del 
//alumno
//Esta es una "solución" temporal solo para mostrar asesorias y poder
//Seguir con el flujo del programa 


//Obtener asesorias


// asesoria.materiaNombre
// asesoria.fecha_inicio
// asesoria.fecha_fin
// asesoria.dias
// asesoria.horario_inicio
// asesoria.horario_fin


app.get('/asesorias/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [asesorias] = await pool.query(`
            SELECT 
                a.idAsesoria AS id_asesoria, 
                a.FechaInicio AS fecha_inicio, 
                a.FechaFin AS fecha_fin,
                GROUP_CONCAT(d.Dia ORDER BY d.idDia SEPARATOR ', ') AS dias,
                a.HorarioInicio AS horario_inicio, 
                a.HorarioFin AS horario_fin,
                a.estado
            FROM Asesoria a
            JOIN Asesoria_Dias ad ON ad.IdAsesoria = a.idAsesoria
            JOIN Dias d ON d.idDia = ad.IdDia
            WHERE a.estado = 'En curso'
              AND a.idAsesoria NOT IN (
                  SELECT idAsesoria FROM Inscripcion WHERE idAlumno = ?
              )
            GROUP BY 
                a.idAsesoria
        `, [id]);

        if (asesorias.length === 0) {
            return res.status(404).json({ error: 'No hay asesorías activas disponibles.' });
        }

        res.json(asesorias);

    } catch (error) {
        console.error('Error al obtener asesorías disponibles:', error);
        res.status(500).json({ error: 'Error al procesar las asesorías del alumno.', detalle: error.message });
    }
});



/*
app.get('/asesorias/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Obtener la carrera del alumno
        const [[alumno]] = await connection.execute(
            `SELECT id_carrera FROM usuarios WHERE id = ?`,
            [id]
        );

        if (!alumno || !alumno.id_carrera) {
            return res.status(404).json({ error: 'El alumno no tiene una carrera asignada.' });
        }

        // Obtener materias de esa carrera
        const [materiasCarrera] = await connection.execute(
            `SELECT id_materia FROM carrera_materias WHERE id_carrera = ?`,
            [alumno.id_carrera]
        );

        if (materiasCarrera.length === 0) {
            return res.status(404).json({ error: 'No se encontraron materias para la carrera del alumno.' });
        }

        const idsMaterias = materiasCarrera.map(m => m.id_materia);

        // Obtener asesorías activas para esas materias a las que aún no se ha inscrito el alumno
        const query = `
            SELECT a.id_asesoria, a.fecha_inicio, a.fecha_fin, a.dias, a.horario_inicio, a.horario_fin, a.estado,
                   m.nombre AS materiaNombre,
                   u.nombre AS maestroNombre,
                   l.nombre AS lugarNombre
            FROM asesoria a
            INNER JOIN materias m ON a.id_materia = m.id
            INNER JOIN usuarios u ON a.id_maestro = u.id
            INNER JOIN lugar l ON a.id_lugar = l.id_lugar
            WHERE a.estado = 'Activo'
              AND a.id_materia IN (?)
              AND a.id_asesoria NOT IN (
                  SELECT id_asesoria FROM alumno_asesoria WHERE id_alumno = ?
              )
        `;

        const [asesorias] = await connection.query(query, [idsMaterias, id]);

        if (asesorias.length === 0) {
            return res.status(404).json({ error: 'No hay asesorías activas disponibles para las materias de la carrera del alumno.' });
        }

        res.json(asesorias);
    } catch (error) {
        console.error('Error al obtener asesorías disponibles:', error);
        res.status(500).json({ error: 'Error al procesar las asesorías del alumno.', detalle: error.message });
    }
});
*/

app.get('/asesoriasSolicitadas/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [asesorias] = await pool.query(`
            SELECT 
                a.idAsesoria AS id_asesoria, 
                a.FechaInicio AS fecha_inicio, 
                a.FechaFin AS fecha_fin,
                GROUP_CONCAT(d.Dia ORDER BY d.idDia SEPARATOR ', ') AS dias,
                a.HorarioInicio AS horario_inicio, 
                a.HorarioFin AS horario_fin,
                a.estado
            FROM Asesoria a
            JOIN Asesoria_Dias ad ON ad.IdAsesoria = a.idAsesoria
            JOIN Dias d ON d.idDia = ad.IdDia
            WHERE a.estado = 'Pendiente'
              AND a.idAlumno = ?
            GROUP BY 
                a.idAsesoria
        `, [id]);

        if (asesorias.length === 0) {
            return res.status(404).json({ error: 'No hay asesorías activas disponibles.' });
        }

        res.json(asesorias);

    } catch (error) {
        console.error('Error al obtener asesorías disponibles:', error);
        res.status(500).json({ error: 'Error al procesar las asesorías del alumno.', detalle: error.message });
    }
});

app.post('/baja', async (req, res) => {
    const { idAsesoria, idUsuario } = req.body;

    if (!idAsesoria || !idUsuario) {
        return res.status(400).json({ error: 'Faltan parámetros.' });
    }

    try {
        const [result] = await pool.execute(
            `DELETE FROM Inscripcion WHERE idAsesoria = ? AND idAlumno = ?`,
            [idAsesoria, idUsuario]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'No se encontró la inscripción del alumno en esa asesoría.' });
        }

        res.sendStatus(204); // Baja exitosa, sin contenido que devolver
    } catch (error) {
        console.error('Error al dar de baja al alumno:', error);
        res.status(500).json({ error: 'Error al eliminar la inscripción.', detalle: error.message });
    }
});



//inicio5
app.post('/alta', async (req, res) => {
  const { idAsesoria, idUsuario } = req.body;
  if (!idAsesoria || !idUsuario)
    return res.status(400).json({ error: 'idAsesoria y idUsuario son requeridos.' });

  try {
    const [inscrito] = await pool.execute(
      'SELECT * FROM Inscripcion WHERE idAsesoria = ? AND idAlumno = ?',
      [idAsesoria, idUsuario]
    );
    if (inscrito.length) {
      return res.status(409).json({ error: 'El usuario ya está inscrito en esta asesoría.' });
    }

    await pool.execute(
      'INSERT INTO Inscripcion (idAlumno, idAsesoria) VALUES (?, ?)',
      [idUsuario, idAsesoria]
    );
    res.status(201).json({ message: 'Usuario inscrito exitosamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ocurrió un error al procesar la inscripción.' });
  }
});


//Esto de Materia siento que va causar problemas mas adelante
app.post('/asesoria', async (req, res) => {
  const { dias, horario_inicio, materia, idAlumno } = req.body;

  if (!dias || !horario_inicio || !materia || !idAlumno) {
    return res.status(400).json({ error: 'Datos incompletos para crear asesoría.' });
  }

  try {
    const horario_fin = calcularHorarioFin(horario_inicio);

    // Insertar asesoría básica
    const [insertResult] = await pool.execute(
      `INSERT INTO Asesoria (
        idDocente, idAlumno, FechaInicio, FechaFin,
        HorarioInicio, HorarioFin, Estado, idLugar
      ) VALUES (NULL, ?, NULL, NULL, ?, ?, 'Pendiente', NULL)`,
      [idAlumno, horario_inicio, horario_fin]
    );

    const idAsesoria = insertResult.insertId;

    // Obtener el idDia correspondiente a cada nombre recibido
    for (const diaNombre of dias) {
      const [rows] = await pool.execute(
        'SELECT idDia FROM Dias WHERE Dia = ?',
        [diaNombre]
      );

      if (rows.length === 0) {
        console.warn(`Día no encontrado: ${diaNombre}`);
        continue;
      }

      const idDia = rows[0].idDia;

      await pool.execute(
        'INSERT INTO Asesoria_Dias (idAsesoria, idDia) VALUES (?, ?)',
        [idAsesoria, idDia]
      );
    }

    res.status(201).json({ message: 'Solicitud de asesoría creada correctamente.', idAsesoria });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear solicitud de asesoría.' });
  }
});
//no contiene materia pero si fucniona 
/*app.post('/asesoria', async (req, res) => {
  console.log('=== INICIO DEBUG ASESORIA ===');
  console.log('Body recibido:', JSON.stringify(req.body, null, 2));
  
  const { dias, horario_inicio, idAlumno } = req.body;
  
  console.log('Datos extraídos:');
  console.log('- dias:', dias, typeof dias);
  console.log('- horario_inicio:', horario_inicio, typeof horario_inicio);
  console.log('- idAlumno:', idAlumno, typeof idAlumno);
  
  if (!dias || !horario_inicio || !idAlumno) {
    console.log('ERROR: Validación falló');
    return res.status(400).json({ error: 'Datos incompletos para crear asesoría.' });
  }
  
  try {
    console.log('Calculando horario_fin...');
    const horario_fin = calcularHorarioFin(horario_inicio);
    console.log('horario_fin calculado:', horario_fin);
    
    console.log('Insertando asesoría...');
    const [insertResult] = await pool.execute(
      `INSERT INTO Asesoria (
        idDocente, idAlumno, FechaInicio, FechaFin,
        HorarioInicio, HorarioFin, Estado, idLugar
      ) VALUES (NULL, ?, NULL, NULL, ?, ?, 'Pendiente', NULL)`,
      [idAlumno, horario_inicio, horario_fin]
    );
    
    const idAsesoria = insertResult.insertId;
    console.log('Asesoría insertada con ID:', idAsesoria);
    
    console.log('Procesando días...');
    for (const diaNombre of dias) {
      console.log('Procesando día:', diaNombre);
      
      const [rows] = await pool.execute(
        'SELECT idDia FROM Dias WHERE Dia = ?',
        [diaNombre]
      );
      
      if (rows.length === 0) {
        console.warn(`Día no encontrado: ${diaNombre}`);
        continue;
      }
      
      const idDia = rows[0].idDia;
      console.log('ID del día encontrado:', idDia);
      
      await pool.execute(
        'INSERT INTO Asesoria_Dias (idAsesoria, idDia) VALUES (?, ?)',
        [idAsesoria, idDia]
      );
      
      console.log('Día insertado correctamente');
    }
    
    console.log('Todo completado exitosamente');
    res.status(201).json({ message: 'Solicitud de asesoría creada correctamente.', idAsesoria });
    
  } catch (err) {
    console.log('=== ERROR CAPTURADO ===');
    console.log('Mensaje:', err.message);
    console.log('Stack:', err.stack);
    console.log('Código SQL:', err.code);
    console.log('SQL State:', err.sqlState);
    console.log('=== FIN ERROR ===');
    
    res.status(500).json({ 
      error: 'Error al crear solicitud de asesoría.',
      details: err.message 
    });
  }
});*/

app.put('/asesoria', async (req, res) => {
  const { id_asesoria, fecha_inicio, id_lugar, idDocente } = req.body;
  if (!id_asesoria || !fecha_inicio || !id_lugar || !idDocente) {
    return res.status(400).json({ error: 'Se requieren id_asesoria, fecha, lugar y maestro.' });
  }

  try {
    const horario_fin = calcularHorarioFin(fecha_inicio);
    const fechaFin = calcularFechaFin(fecha_inicio);

    const [result] = await pool.execute(
      `UPDATE Asesoria
        SET FechaInicio = ?, FechaFin = ?, idLugar = ?, idDocente = ?, Estado = 'Activo'
       WHERE idAsesoria = ?`,
      [fecha_inicio, fechaFin, id_lugar, idDocente, id_asesoria]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Asesoría no encontrada.' });
    }
    res.json({ message: 'Asesoría actualizada correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la asesoría.' });
  }
});

app.put('/cancelarasesoria', async (req, res) => {
  const { idAsesoria } = req.body;
  if (!idAsesoria) {
    return res.status(400).json({ error: 'El ID de la asesoría es obligatorio.' });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE Asesoria SET Estado = 'Cancelada' WHERE idAsesoria = ?`,
      [idAsesoria]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Asesoría no encontrada.' });
    }
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cancelar la asesoría.' });
  }
});


app.get('/asesoriasPendientes', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.idAsesoria AS id_asesoria, a.FechaInicio AS fecha_inicio,
             a.FechaFin AS fecha_fin, a.Dias AS dias, a.HorarioInicio AS horario_inicio,
             a.HorarioFin AS horario_fin, a.Estado AS estado,
             m.Nombre AS materiaNombre, CONCAT(d.Nombre,' ',d.ApellidoPaterno,' ',d.ApellidoMaterno) AS maestroNombre,
             l.Nombre AS lugarNombre
      FROM Asesoria a
      LEFT JOIN Materia m ON a.idMateria = m.idMateria
      LEFT JOIN Docente d ON a.idDocente = d.idDocente
      LEFT JOIN Lugar l ON a.idLugar = l.idLugar
      WHERE a.Estado = 'Pendiente'
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener asesorías pendientes.' });
  }
});


app.get('/asesorias/asesor/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT a.idAsesoria AS id_asesoria, a.FechaInicio AS fecha_inicio,
             a.FechaFin AS fecha_fin, a.Dias AS dias, a.HorarioInicio AS horario_inicio,
             a.HorarioFin AS horario_fin, a.Estado AS estado,
             m.Nombre AS materiaNombre, CONCAT(d.Nombre,' ',d.ApellidoPaterno,' ',d.ApellidoMaterno) AS maestroNombre,
             l.Nombre AS lugarNombre
      FROM Asesoria a
      LEFT JOIN Materia m ON a.idMateria = m.idMateria
      LEFT JOIN Docente d ON a.idDocente = d.idDocente
      LEFT JOIN Lugar l ON a.idLugar = l.idLugar
      WHERE a.idDocente = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'El profesor no tiene asesorías asignadas.' });
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener asesorías del profesor.' });
  }
});

function calcularHorarioFin(horarioInicio) {
  const [hora, minutos] = horarioInicio.split(':').map(Number);
  let nuevaHora = hora + 1;
  if (nuevaHora >= 24) nuevaHora -= 24; // Para mantener el formato 24h

  return `${nuevaHora.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
}

function calcularFechaFin(fechaInicio) {
  const fecha = new Date(fechaInicio);
  fecha.setDate(fecha.getDate() + 30); // Por ejemplo, un mes después
  return fecha.toISOString().split('T')[0]; // Devuelve en formato YYYY-MM-DD
}

// Iniciar el servidor
app.listen(3001, () => {
    console.log('Servidor Express corriendo en el puerto 3001');
});