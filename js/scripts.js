// ================== HEADER: TÍTULO ==================
const header = document.querySelector("header")

const seccionTitulo = document.createElement("section")
seccionTitulo.classList = "titulo"
header.appendChild(seccionTitulo)

const h1 = document.createElement("h1")
h1.innerText = "RECETAS"
seccionTitulo.appendChild(h1)

// ================== MAIN ==================
const main = document.querySelector("main")

// ------- Sección para agregar receta -------
const seccionAgregar = document.createElement("section")
seccionAgregar.classList = "agregarReceta"
main.appendChild(seccionAgregar)

// Campo: título de la receta
const labelTitulo = document.createElement("label")
labelTitulo.innerText = "Título de la receta:"
labelTitulo.htmlFor = "titulo-receta"
seccionAgregar.appendChild(labelTitulo)

const inputTitulo = document.createElement("input")
inputTitulo.type = "text"
inputTitulo.id = "titulo-receta"
inputTitulo.placeholder = "Ej: Tarta de atún"
seccionAgregar.appendChild(inputTitulo)

// Campo: lista de ingredientes / pasos
const labelLista = document.createElement("label")
labelLista.innerText = "Ingredientes / pasos (uno por línea o separados por comas):"
labelLista.htmlFor = "lista-receta"
seccionAgregar.appendChild(labelLista)

const textareaLista = document.createElement("textarea")
textareaLista.id = "lista-receta"
textareaLista.rows = 5
textareaLista.placeholder = "Ej:\n2 huevos\n1 taza de leche\n1 pizca de sal"
seccionAgregar.appendChild(textareaLista)

// Botón: agregar receta
const buttonAgregar = document.createElement("button")
buttonAgregar.innerText = "Agregar receta"
seccionAgregar.appendChild(buttonAgregar)

// ------- Mural de recetas -------
const muralRecetas = document.createElement("section")
muralRecetas.classList = "mural-recetas"
main.appendChild(muralRecetas)


// ================== LOCALSTORAGE ==================

function obtenerRecetasDesdeLocalStorage() {
    return JSON.parse(localStorage.getItem("listaRecetas")) || []
}

function guardarRecetasEnLocalStorage(recetas) {
    localStorage.setItem("listaRecetas", JSON.stringify(recetas))
}

// Agregar una receta
function agregarReceta(titulo, textoLista) {
    const tituloLimpio = titulo.trim()
    const textoLimpio = textoLista.trim()

    if (tituloLimpio === "" || textoLimpio === "") return

    // Aceptamos items separados por líneas o por comas
    let items = []
    if (textoLimpio.includes("\n")) {
        items = textoLimpio.split("\n")
    } else {
        items = textoLimpio.split(",")
    }

    items = items
        .map(t => t.trim())
        .filter(t => t !== "")

    if (items.length === 0) return

    const nuevaReceta = {
        titulo: tituloLimpio,
        items: items
    }

    const recetas = obtenerRecetasDesdeLocalStorage()
    recetas.push(nuevaReceta)
    guardarRecetasEnLocalStorage(recetas)
}

// Eliminar receta por índice
function eliminarReceta(index) {
    const recetas = obtenerRecetasDesdeLocalStorage()
    recetas.splice(index, 1)
    guardarRecetasEnLocalStorage(recetas)
    cargarRecetasDesdeLocalStorage()
}

// ================== RENDERIZAR EN EL DOM ==================

function cargarRecetasDesdeLocalStorage() {
    const recetas = obtenerRecetasDesdeLocalStorage()

    muralRecetas.innerHTML = ""

    recetas.forEach((receta, index) => {
        // Card / bloque de receta
        const card = document.createElement("article")
        card.classList.add("receta-card")

        // Alternar colores: oscura / clara
        if (index % 2 === 0) {
            card.classList.add("receta-oscura")
        } else {
            card.classList.add("receta-clara")
        }

        // Título
        const titulo = document.createElement("h2")
        titulo.innerText = receta.titulo
        card.appendChild(titulo)

        // Lista de items
        const ul = document.createElement("ul")
        receta.items.forEach(textoItem => {
            const li = document.createElement("li")
            li.innerText = textoItem
            ul.appendChild(li)
        })
        card.appendChild(ul)

        // Botón eliminar receta
        const btnEliminar = document.createElement("button")
        btnEliminar.innerText = "Eliminar receta"
        btnEliminar.classList.add("btn-eliminar-receta")
        btnEliminar.setAttribute("data-index", index)
        card.appendChild(btnEliminar)

        muralRecetas.appendChild(card)
    })
}

// ================== EVENTOS ==================

// Click en "Agregar receta"
buttonAgregar.addEventListener("click", function () {
    const titulo = inputTitulo.value
    const lista = textareaLista.value

    agregarReceta(titulo, lista)

    // Limpio campos
    inputTitulo.value = ""
    textareaLista.value = ""
    inputTitulo.focus()

    // Recargo mural
    cargarRecetasDesdeLocalStorage()
})

// Enter en título -> foco al textarea
inputTitulo.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault()
        textareaLista.focus()
    }
})

// Delegación de eventos para eliminar receta
muralRecetas.addEventListener("click", function (event) {
    if (event.target.classList.contains("btn-eliminar-receta")) {
        const index = parseInt(event.target.getAttribute("data-index"))
        eliminarReceta(index)
    }
})

// Cargar al inicio
window.addEventListener("load", cargarRecetasDesdeLocalStorage)
