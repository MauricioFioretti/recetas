// ================== CONFIG ==================
const API_URL = "https://script.google.com/macros/s/AKfycbx0U0vrNAObl8naj9TJTnj9ZtX5Kj52WO-6dVYCo2_UrFtaXA4WGPKm7VmmqaWRc9UNMQ/exec"

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

// ================== FUNCIONES API ==================

// Cargar recetas desde Google Sheets (vía Apps Script)
async function cargarRecetasDesdeAPI() {
  try {
    const resp = await fetch(API_URL)
    const recetas = await resp.json()

    muralRecetas.innerHTML = ""

    recetas.forEach((receta, index) => {
      const card = document.createElement("article")
      card.classList.add("receta-card")

      // alternar tonos para distinguir
      if (index % 2 === 0) {
        card.classList.add("receta-oscura")
      } else {
        card.classList.add("receta-clara")
      }

      const titulo = document.createElement("h2")
      titulo.innerText = receta.titulo
      card.appendChild(titulo)

      const ul = document.createElement("ul")
      receta.items.forEach(textoItem => {
        const li = document.createElement("li")
        li.innerText = textoItem
        ul.appendChild(li)
      })
      card.appendChild(ul)

      // ❌ No ponemos botón eliminar para que nadie borre cosas desde la web
      muralRecetas.appendChild(card)
    })
  } catch (err) {
    console.error("Error al cargar recetas", err)
  }
}

// Agregar receta nueva a la hoja (vía formulario x-www-form-urlencoded)
async function agregarRecetaAPI(titulo, textoLista) {
  const tituloLimpio = titulo.trim()
  const textoLimpio = textoLista.trim()
  if (!tituloLimpio || !textoLimpio) return

  let items = textoLimpio.includes("\n")
    ? textoLimpio.split("\n")
    : textoLimpio.split(",")

  items = items.map(t => t.trim()).filter(t => t !== "")
  if (!items.length) return

  const body = {
    titulo: tituloLimpio,
    items: items
  }

  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })

    await cargarRecetasDesdeAPI()
  } catch (err) {
    console.error("Error al agregar receta", err)
  }
}


// ================== EVENTOS ==================

// Click en "Agregar receta"
buttonAgregar.addEventListener("click", () => {
  agregarRecetaAPI(inputTitulo.value, textareaLista.value)
  inputTitulo.value = ""
  textareaLista.value = ""
  inputTitulo.focus()
})

// Enter en título -> pasa al textarea
inputTitulo.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault()
    textareaLista.focus()
  }
})

// Cargar al iniciar
window.addEventListener("load", cargarRecetasDesdeAPI)
