
import { supabase } from "./supabase.js";

// ==========================================
// CONFIGURACIÓN
// ==========================================

const TABLA_PACIENTES = "pacientes";
const BUCKET_FOTOS = "fotos_Pacientes";
const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024;
const TIPOS_FOTO_PERMITIDOS = [
    "image/jpeg",
    "image/png",
    "image/webp"
];

let pacientes = [];
let urlsFotos = new Map();
let fotoSeleccionada = null;
let urlPreviaLocal = null;
let notificacionTemporizador = null;
let ultimoElementoEnfocado = null;

// ==========================================
// ELEMENTOS HTML
// ==========================================

const formPaciente = document.getElementById("formPaciente");
const nombrePaciente = document.getElementById("nombrePaciente");
const fechaNacimiento = document.getElementById("fechaNacimiento");
const departamento = document.getElementById("departamento");
const provincia = document.getElementById("provincia");
const municipio = document.getElementById("municipio");
const fotoPaciente = document.getElementById("fotoPaciente");

const vistaFoto = document.getElementById("vistaFoto");
const previewFoto = document.getElementById("previewFoto");
const nombreArchivoFoto = document.getElementById("nombreArchivoFoto");
const quitarFoto = document.getElementById("quitarFoto");

const listaPacientes = document.getElementById("listaPacientes");
const buscarPaciente = document.getElementById("buscarPaciente");

const totalPacientes = document.getElementById("totalPacientes");
const totalDepartamentos = document.getElementById("totalDepartamentos");
const pacientesHoy = document.getElementById("pacientesHoy");

const estadoCarga = document.getElementById("estadoCarga");
const sinPacientes = document.getElementById("sinPacientes");

const btnGuardar = document.getElementById("btnGuardar");
const btnImprimirFotos = document.getElementById("btnImprimirFotos");

const notificacion = document.getElementById("notificacion");
const iconoNotificacion = document.getElementById("iconoNotificacion");
const mensajeNotificacion = document.getElementById("mensajeNotificacion");

// Modal de fotografía
const modalFoto = document.getElementById("modalFoto");
const imagenModalFoto = document.getElementById("imagenModalFoto");
const nombreModalFoto = document.getElementById("nombreModalFoto");
const cerrarModalFoto = document.getElementById("cerrarModalFoto");

// Navegación
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");
const sidebarOverlay = document.getElementById("sidebarOverlay");

// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener("DOMContentLoaded", inicializarAplicacion);

async function inicializarAplicacion() {
    configurarEventos();
    configurarFechaMaxima();
    await cargarPacientes();
}

// ==========================================
// EVENTOS
// ==========================================

function configurarEventos() {
    formPaciente?.addEventListener("submit", registrarPaciente);

    fotoPaciente?.addEventListener("change", manejarSeleccionFoto);

    quitarFoto?.addEventListener("click", limpiarFotoSeleccionada);

    buscarPaciente?.addEventListener("input", filtrarPacientes);

    btnImprimirFotos?.addEventListener("click", imprimirFotosPacientes);

    cerrarModalFoto?.addEventListener("click", cerrarVistaPreviaFoto);

    modalFoto?.addEventListener("click", (evento) => {
        if (evento.target === modalFoto) {
            cerrarVistaPreviaFoto();
        }
    });

    document.addEventListener("keydown", (evento) => {
        if (
            evento.key === "Escape" &&
            modalFoto?.classList.contains("activo")
        ) {
            cerrarVistaPreviaFoto();
        }
    });

    menuToggle?.addEventListener("click", alternarMenu);

    sidebarOverlay?.addEventListener("click", cerrarMenu);

    document.querySelectorAll(".nav-link").forEach((enlace) => {
        enlace.addEventListener("click", () => {
            document.querySelectorAll(".nav-link").forEach((item) => {
                item.classList.remove("active");
            });

            enlace.classList.add("active");
            cerrarMenu();
        });
    });

    formPaciente?.addEventListener("reset", () => {
        // El evento reset ocurre antes de que el navegador
        // termine de restablecer los controles.
        setTimeout(() => {
            limpiarFotoSeleccionada();
        }, 0);
    });
}

function configurarFechaMaxima() {
    if (fechaNacimiento) {
        fechaNacimiento.max = obtenerFechaLocal();
    }
}

function obtenerFechaLocal() {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const dia = String(ahora.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

// ==========================================
// NOTIFICACIONES
// ==========================================

function mostrarNotificacion(mensaje, tipo = "exito") {
    if (!notificacion || !mensajeNotificacion || !iconoNotificacion) {
        return;
    }

    clearTimeout(notificacionTemporizador);

    mensajeNotificacion.textContent = mensaje;

    notificacion.classList.remove("exito", "error", "advertencia");
    notificacion.classList.add(tipo);

    if (tipo === "error") {
        iconoNotificacion.className = "fa-solid fa-circle-exclamation";
    } else if (tipo === "advertencia") {
        iconoNotificacion.className = "fa-solid fa-triangle-exclamation";
    } else {
        iconoNotificacion.className = "fa-solid fa-circle-check";
    }

    notificacion.hidden = false;

    notificacionTemporizador = setTimeout(() => {
        notificacion.hidden = true;
    }, 4000);
}

function mostrarError(error, mensajePredeterminado = "Ocurrió un error.") {
    console.error(error);

    const mensaje = error?.message || mensajePredeterminado;
    mostrarNotificacion(mensaje, "error");
}

// ==========================================
// CARGAR PACIENTES
// ==========================================

async function cargarPacientes() {
    if (estadoCarga) {
        estadoCarga.hidden = false;
    }

    if (listaPacientes) {
        listaPacientes.innerHTML = "";
    }

    if (sinPacientes) {
        sinPacientes.hidden = true;
    }

    try {
        const { data, error } = await supabase
            .from(TABLA_PACIENTES)
            .select("*")
            .order("creado_en", { ascending: false });

        if (error) {
            throw error;
        }

        pacientes = data || [];
        urlsFotos.clear();

        await Promise.all(
            pacientes.map(async (paciente) => {
                if (!paciente.foto) {
                    return;
                }

                const url = await obtenerUrlFoto(paciente.foto);

                if (url) {
                    urlsFotos.set(paciente.id, url);
                }
            })
        );

        actualizarEstadisticas();
        renderizarPacientes(pacientes);

    } catch (error) {
        mostrarError(
            error,
            "No se pudieron cargar los pacientes. Revisa la conexión con Supabase."
        );

        if (sinPacientes) {
            sinPacientes.hidden = false;
        }
    } finally {
        if (estadoCarga) {
            estadoCarga.hidden = true;
        }
    }
}

// ==========================================
// REGISTRO DE PACIENTES
// ==========================================

async function registrarPaciente(evento) {
    evento.preventDefault();

    if (!formPaciente || !btnGuardar) {
        return;
    }

    const nombre = nombrePaciente.value.trim();
    const fecha = fechaNacimiento.value;
    const depto = departamento.value;
    const prov = provincia.value.trim();
    const muni = municipio.value.trim();

    if (!nombre || !fecha || !depto || !prov || !muni) {
        mostrarNotificacion(
            "Completa todos los campos obligatorios.",
            "advertencia"
        );
        return;
    }

    if (fecha > obtenerFechaLocal()) {
        mostrarNotificacion(
            "La fecha de nacimiento no puede ser futura.",
            "advertencia"
        );
        return;
    }

    if (fotoSeleccionada && !validarFoto(fotoSeleccionada)) {
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Guardando...
    `;

    let rutaFotoSubida = null;

    try {
        // Primero se sube la fotografía, si existe.
        if (fotoSeleccionada) {
            rutaFotoSubida = await subirFoto(fotoSeleccionada);
        }

        const nuevoPaciente = {
            nombre_Paciente: nombre,
            fecha_nacimiento: fecha,
            departamento: depto,
            provincia: prov,
            municipio: muni,
            foto: rutaFotoSubida
        };

        const { error } = await supabase
            .from(TABLA_PACIENTES)
            .insert([nuevoPaciente]);

        if (error) {
            throw error;
        }

        mostrarNotificacion("Paciente registrado correctamente.");

        formPaciente.reset();
        limpiarFotoSeleccionada();

        await cargarPacientes();

        document.getElementById("pacientes")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        // Si la inserción falla después de subir la foto,
        // intentamos retirar el archivo para no dejarlo huérfano.
        if (rutaFotoSubida) {
            const { error: errorEliminacion } = await supabase
                .storage
                .from(BUCKET_FOTOS)
                .remove([rutaFotoSubida]);

            if (errorEliminacion) {
                console.error(
                    "No se pudo retirar la fotografía subida:",
                    errorEliminacion
                );
            }
        }

        mostrarError(
            error,
            "No se pudo registrar el paciente."
        );
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = `
            <i class="fa-solid fa-floppy-disk"></i>
            Guardar paciente
        `;
    }
}

// ==========================================
// FOTOGRAFÍA: VALIDACIÓN Y VISTA PREVIA
// ==========================================

function validarFoto(archivo) {
    if (!TIPOS_FOTO_PERMITIDOS.includes(archivo.type)) {
        mostrarNotificacion(
            "Selecciona una imagen JPG, PNG o WEBP.",
            "advertencia"
        );
        return false;
    }

    if (archivo.size > TAMANO_MAXIMO_FOTO) {
        mostrarNotificacion(
            "La fotografía no puede superar los 5 MB.",
            "advertencia"
        );
        return false;
    }

    return true;
}

function manejarSeleccionFoto(evento) {
    const archivo = evento.target.files?.[0];

    if (!archivo) {
        return;
    }

    if (!validarFoto(archivo)) {
        fotoPaciente.value = "";
        return;
    }

    liberarUrlPreviaLocal();

    fotoSeleccionada = archivo;
    urlPreviaLocal = URL.createObjectURL(archivo);

    previewFoto.src = urlPreviaLocal;
    nombreArchivoFoto.textContent = archivo.name;
    vistaFoto.hidden = false;
}

function limpiarFotoSeleccionada() {
    fotoSeleccionada = null;

    liberarUrlPreviaLocal();

    if (fotoPaciente) {
        fotoPaciente.value = "";
    }

    if (previewFoto) {
        previewFoto.removeAttribute("src");
    }

    if (nombreArchivoFoto) {
        nombreArchivoFoto.textContent = "";
    }

    if (vistaFoto) {
        vistaFoto.hidden = true;
    }
}

function liberarUrlPreviaLocal() {
    if (urlPreviaLocal) {
        URL.revokeObjectURL(urlPreviaLocal);
        urlPreviaLocal = null;
    }
}

// ==========================================
// SUBIR FOTOGRAFÍA A SUPABASE STORAGE
// ==========================================

async function subirFoto(archivo) {
    const extensionPorTipo = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
    };

    const extension = extensionPorTipo[archivo.type];

    if (!extension) {
        throw new Error("Formato de fotografía no permitido.");
    }

    const nombreUnico = generarIdentificador();

    const ruta = `${nombreUnico}.${extension}`;

    const { error } = await supabase
        .storage
        .from(BUCKET_FOTOS)
        .upload(ruta, archivo, {
            cacheControl: "3600",
            upsert: false,
            contentType: archivo.type
        });

    if (error) {
        throw error;
    }

    return ruta;
}

function generarIdentificador() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ==========================================
// OBTENER URL FIRMADA DE FOTO PRIVADA
// ==========================================

async function obtenerUrlFoto(ruta) {
    if (!ruta || typeof ruta !== "string") {
        return null;
    }

    // Si hay datos antiguos que contienen una URL completa,
    // intentamos obtener el nombre del archivo de la ruta.
    let rutaArchivo = ruta;

    if (/^https?:\/\//i.test(ruta)) {
        try {
            const url = new URL(ruta);
            const marcador = `/${BUCKET_FOTOS}/`;
            const posicion = url.pathname.indexOf(marcador);

            if (posicion === -1) {
                console.warn("No se pudo reconocer la ruta de la foto.");
                return null;
            }

            rutaArchivo = decodeURIComponent(
                url.pathname.slice(posicion + marcador.length)
            );

            // Las URLs antiguas pueden incluir /object/public/
            // o /object/sign/ antes del nombre del bucket.
            rutaArchivo = rutaArchivo.replace(/^\/+/, "");
        } catch (error) {
            console.error("URL de fotografía no válida:", error);
            return null;
        }
    }

    const { data, error } = await supabase
        .storage
        .from(BUCKET_FOTOS)
        .createSignedUrl(rutaArchivo, 3600);

    if (error) {
        console.error("No se pudo obtener la fotografía:", error);
        return null;
    }

    return data?.signedUrl || null;
}

// ==========================================
// ESTADÍSTICAS
// ==========================================

function actualizarEstadisticas() {
    if (totalPacientes) {
        totalPacientes.textContent = pacientes.length;
    }

    const departamentosUnicos = new Set(
        pacientes
            .map((paciente) =>
                normalizarTexto(paciente.departamento)
            )
            .filter(Boolean)
    );

    if (totalDepartamentos) {
        totalDepartamentos.textContent = departamentosUnicos.size;
    }

    const hoy = obtenerFechaLocal();

    const registrosDeHoy = pacientes.filter((paciente) => {
        if (!paciente.creado_en) {
            return false;
        }

        const fechaRegistro = new Date(paciente.creado_en);

        if (Number.isNaN(fechaRegistro.getTime())) {
            return false;
        }

        const fechaLocal =
            `${fechaRegistro.getFullYear()}-` +
            `${String(fechaRegistro.getMonth() + 1).padStart(2, "0")}-` +
            `${String(fechaRegistro.getDate()).padStart(2, "0")}`;

        return fechaLocal === hoy;
    }).length;

    if (pacientesHoy) {
        pacientesHoy.textContent = registrosDeHoy;
    }
}

function normalizarTexto(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

// ==========================================
// MOSTRAR TARJETAS DE PACIENTES
// ==========================================

function renderizarPacientes(lista) {
    if (!listaPacientes) {
        return;
    }

    listaPacientes.innerHTML = "";

    if (lista.length === 0) {
        if (sinPacientes) {
            sinPacientes.hidden = false;
        }

        return;
    }

    if (sinPacientes) {
        sinPacientes.hidden = true;
    }

    const fragmento = document.createDocumentFragment();

    lista.forEach((paciente) => {
        const tarjeta = document.createElement("article");
        tarjeta.className = "patient-card";

        const contenedorFoto = document.createElement("div");
        contenedorFoto.className = "patient-card-photo";

        const urlFoto = urlsFotos.get(paciente.id);

        if (urlFoto) {
            const imagen = document.createElement("img");

            imagen.src = urlFoto;
            imagen.alt = `Fotografía de ${paciente.nombre_Paciente || "paciente"}`;
            imagen.loading = "lazy";
            imagen.className = "foto-paciente-clickeable";
            imagen.tabIndex = 0;
            imagen.setAttribute("role", "button");
            imagen.setAttribute(
                "aria-label",
                `Ampliar fotografía de ${paciente.nombre_Paciente || "paciente"}`
            );
            imagen.title = "Haz clic para ampliar la fotografía";

            // NUEVA FUNCIÓN: clic en la fotografía.
            imagen.addEventListener("click", () => {
                abrirVistaPreviaFoto(
                    urlFoto,
                    paciente.nombre_Paciente
                );
            });

            // También se puede abrir con Enter o barra espaciadora.
            imagen.addEventListener("keydown", (evento) => {
                if (evento.key === "Enter" || evento.key === " ") {
                    evento.preventDefault();

                    abrirVistaPreviaFoto(
                        urlFoto,
                        paciente.nombre_Paciente
                    );
                }
            });

            imagen.addEventListener("error", () => {
                imagen.remove();
                mostrarIconoSinFoto(contenedorFoto);
            }, { once: true });

            contenedorFoto.appendChild(imagen);
        } else {
            mostrarIconoSinFoto(contenedorFoto);
        }

        const contenido = document.createElement("div");
        contenido.className = "patient-card-content";

        const nombre = document.createElement("h3");
        nombre.className = "patient-card-name";
        nombre.textContent = paciente.nombre_Paciente || "Sin nombre";

        const fecha = document.createElement("p");
        fecha.className = "patient-card-detail";

        const iconoFecha = document.createElement("i");
        iconoFecha.className = "fa-solid fa-calendar-days";

        fecha.appendChild(iconoFecha);
        fecha.appendChild(
            document.createTextNode(
                ` Nacimiento: ${formatearFecha(paciente.fecha_nacimiento)}`
            )
        );

        const ubicacion = document.createElement("p");
        ubicacion.className = "patient-card-detail";

        const iconoUbicacion = document.createElement("i");
        iconoUbicacion.className = "fa-solid fa-location-dot";

        ubicacion.appendChild(iconoUbicacion);
        ubicacion.appendChild(
            document.createTextNode(
                ` ${paciente.municipio || "Sin municipio"}, ` +
                `${paciente.provincia || "Sin provincia"}`
            )
        );

        const departamentoTexto = document.createElement("span");
        departamentoTexto.className = "patient-card-department";
        departamentoTexto.textContent =
            paciente.departamento || "Sin departamento";

        contenido.appendChild(nombre);
        contenido.appendChild(fecha);
        contenido.appendChild(ubicacion);
        contenido.appendChild(departamentoTexto);

        tarjeta.appendChild(contenedorFoto);
        tarjeta.appendChild(contenido);

        fragmento.appendChild(tarjeta);
    });

    listaPacientes.appendChild(fragmento);
}

function mostrarIconoSinFoto(contenedor) {
    if (contenedor.querySelector(".patient-no-photo")) {
        return;
    }

    const marcador = document.createElement("div");
    marcador.className = "patient-no-photo";

    const icono = document.createElement("i");
    icono.className = "fa-solid fa-user";

    marcador.appendChild(icono);
    contenedor.appendChild(marcador);
}

function formatearFecha(fecha) {
    if (!fecha) {
        return "No disponible";
    }

    const partes = String(fecha).split("-");

    if (partes.length !== 3) {
        return fecha;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// ==========================================
// VISTA PREVIA AMPLIADA DE FOTOGRAFÍAS
// ==========================================

function abrirVistaPreviaFoto(url, nombre) {
    if (!url || !modalFoto || !imagenModalFoto || !nombreModalFoto) {
        return;
    }

    ultimoElementoEnfocado = document.activeElement;

    imagenModalFoto.src = url;
    imagenModalFoto.alt = `Fotografía de ${nombre || "paciente"}`;
    nombreModalFoto.textContent = nombre || "Fotografía del paciente";

    modalFoto.classList.add("activo");
    modalFoto.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";

    cerrarModalFoto?.focus();
}

function cerrarVistaPreviaFoto() {
    if (!modalFoto) {
        return;
    }

    modalFoto.classList.remove("activo");
    modalFoto.setAttribute("aria-hidden", "true");

    document.body.style.overflow = "";

    if (imagenModalFoto) {
        imagenModalFoto.removeAttribute("src");
    }

    if (ultimoElementoEnfocado?.isConnected) {
        ultimoElementoEnfocado.focus();
    }

    ultimoElementoEnfocado = null;
}

// ==========================================
// BÚSQUEDA DE PACIENTES
// ==========================================

function filtrarPacientes() {
    const consulta = normalizarTexto(buscarPaciente?.value);

    if (!consulta) {
        renderizarPacientes(pacientes);
        return;
    }

    const resultados = pacientes.filter((paciente) => {
        const contenido = [
            paciente.nombre_Paciente,
            paciente.departamento,
            paciente.provincia,
            paciente.municipio,
            paciente.fecha_nacimiento
        ]
            .map(normalizarTexto)
            .join(" ");

        return contenido.includes(consulta);
    });

    renderizarPacientes(resultados);
}

// ==========================================
// IMPRIMIR FOTOGRAFÍAS: 6 POR HOJA
// ==========================================

async function imprimirFotosPacientes() {
    const pacientesConFoto = pacientes.filter((paciente) =>
        urlsFotos.has(paciente.id)
    );

    if (pacientesConFoto.length === 0) {
        mostrarNotificacion(
            "No hay fotografías disponibles para imprimir.",
            "advertencia"
        );
        return;
    }

    const ventanaImpresion = window.open("", "_blank");

    if (!ventanaImpresion) {
        mostrarNotificacion(
            "Permite las ventanas emergentes para imprimir.",
            "advertencia"
        );
        return;
    }

    const fotosHTML = pacientesConFoto.map((paciente) => {
        const url = urlsFotos.get(paciente.id);

        return `
            <div class="foto-impresion">
                <img
                    src="${escaparAtributoHTML(url)}"
                    alt="Fotografía de ${escaparAtributoHTML(paciente.nombre_Paciente)}"
                >
                <p>${escaparHTML(paciente.nombre_Paciente || "")}</p>
            </div>
        `;
    }).join("");

    ventanaImpresion.document.open();

    ventanaImpresion.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <title>Fotografías de pacientes</title>

            <style>
                @page {
                    size: letter portrait;
                    margin: 1.2cm;
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    font-family: Arial, sans-serif;
                    color: #222;
                }

                h1 {
                    margin: 0 0 6px;
                    text-align: center;
                    font-size: 18px;
                }

                .subtitulo {
                    margin: 0 0 18px;
                    text-align: center;
                    font-size: 11px;
                }

                .rejilla-fotos {
                    display: grid;
                    grid-template-columns: repeat(3, 5cm);
                    grid-auto-rows: 5cm;
                    justify-content: center;
                    gap: 0.5cm;
                }

                .foto-impresion {
                    width: 5cm;
                    height: 5cm;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    border: 1px solid #ddd;
                    padding: 2mm;
                    break-inside: avoid;
                }

                .foto-impresion img {
                    width: 100%;
                    height: 3.8cm;
                    object-fit: contain;
                }

                .foto-impresion p {
                    width: 100%;
                    margin: 2mm 0 0;
                    overflow: hidden;
                    text-align: center;
                    font-size: 8px;
                    line-height: 1.2;
                    overflow-wrap: anywhere;
                }

                @media print {
                    .rejilla-fotos {
                        break-inside: auto;
                    }

                    .foto-impresion {
                        break-inside: avoid;
                    }
                }
            </style>
        </head>

        <body>
            
            <p class="subtitulo">Fotografías de pacientes · SharingSmiles</p>

            <div class="rejilla-fotos">
                ${fotosHTML}
            </div>

            <script>
                const imagenes = Array.from(document.images);

                Promise.all(
                    imagenes.map((imagen) => {
                        if (imagen.complete) {
                            return Promise.resolve();
                        }

                        return new Promise((resolver) => {
                            imagen.onload = resolver;
                            imagen.onerror = resolver;
                        });
                    })
                ).then(() => {
                    setTimeout(() => {
                        window.focus();
                        window.print();
                    }, 300);
                });
            <\/script>
        </body>
        </html>
    `);

    ventanaImpresion.document.close();
}

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caracter) => {
        const entidades = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entidades[caracter];
    });
}

function escaparAtributoHTML(valor) {
    return escaparHTML(valor);
}

// ==========================================
// MENÚ LATERAL RESPONSIVE
// ==========================================

function alternarMenu() {
    sidebar?.classList.toggle("activo");
    sidebarOverlay?.classList.toggle("activo");
}

function cerrarMenu() {
    sidebar?.classList.remove("activo");
    sidebarOverlay?.classList.remove("activo");
}
