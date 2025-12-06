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

// Campo: autor de la receta
const labelAutor = document.createElement("label")
labelAutor.innerText = "Autor:"
labelAutor.htmlFor = "autor-receta"
seccionAgregar.appendChild(labelAutor)

const inputAutor = document.createElement("input")
inputAutor.type = "text"
inputAutor.id = "autor-receta"
inputAutor.placeholder = "Ej: Mauricio"
seccionAgregar.appendChild(inputAutor)


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

// Campo: instrucciones de preparación (opcional)
const labelPrep = document.createElement("label")
labelPrep.innerText = "Instrucciones de preparación (opcional):"
labelPrep.htmlFor = "prep-receta"
seccionAgregar.appendChild(labelPrep)

const textareaPreparacion = document.createElement("textarea")
textareaPreparacion.id = "prep-receta"
textareaPreparacion.rows = 4
textareaPreparacion.placeholder = "Ej:\n1) Mezclá todo...\n2) Llevá al horno 40 min...\n(este campo es opcional)"
seccionAgregar.appendChild(textareaPreparacion)

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
    const resp = await fetch(API_URL)          // modo "lista"
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

      const autor = document.createElement("p")
      autor.classList.add("autor-receta")
      autor.innerText = "Autor: " + (receta.autor || "Sin autor")
      card.appendChild(autor)

      const ul = document.createElement("ul")
      receta.items.forEach(textoItem => {
        const li = document.createElement("li")
        li.innerText = textoItem
        ul.appendChild(li)
      })
      card.appendChild(ul)

      // Bloque de preparación (si viene desde la API)
      if (receta.preparacion && receta.preparacion.trim() !== "") {
        const subtituloPrep = document.createElement("h3")
        subtituloPrep.classList.add("prep-titulo")
        subtituloPrep.innerText = "Preparación"
        card.appendChild(subtituloPrep)

        const ol = document.createElement("ol")
        ol.classList.add("prep-lista")

        // cada línea de la preparación como un paso
        const pasos = receta.preparacion.split("\n").map(p => p.trim()).filter(p => p !== "")
        pasos.forEach(pasoTexto => {
          const liPaso = document.createElement("li")
          liPaso.innerText = pasoTexto
          ol.appendChild(liPaso)
        })

        card.appendChild(ol)
      }


      // ----- BOTÓN COPIAR -----
      const btnCopiar = document.createElement("button")
      btnCopiar.innerText = "Copiar receta"
      btnCopiar.classList.add("btn-copiar-receta")

      btnCopiar.addEventListener("click", () => {
        // Ingredientes
        let texto = receta.titulo + "\n\n" + receta.items.join("\n")

        // Si hay preparación, la agregamos también
        if (receta.preparacion && receta.preparacion.trim() !== "") {
          texto += "\n\nPreparación:\n" + receta.preparacion.trim()
        }

        navigator.clipboard.writeText(texto)
          .then(() => {
            btnCopiar.innerText = "¡Copiado!"
            setTimeout(() => btnCopiar.innerText = "Copiar receta", 1500)
          })
          .catch(() => alert("No se pudo copiar 😢"))
      })

      card.appendChild(btnCopiar)



      muralRecetas.appendChild(card)
    })
  } catch (err) {
    console.error("Error al cargar recetas", err)
  }
}

// // Agregar receta nueva a la hoja (usando GET con modo=add)
// async function agregarRecetaAPI(titulo, textoLista) {
//   const tituloLimpio = titulo.trim()
//   const textoLimpio = textoLista.trim()
//   if (!tituloLimpio || !textoLimpio) return

//   let items = textoLimpio.includes("\n")
//     ? textoLimpio.split("\n")
//     : textoLimpio.split(",")

//   items = items.map(t => t.trim()).filter(t => t !== "")
//   if (!items.length) return

//   // mandamos los datos como query string
//   const autorLimpio = (inputAutor.value || "Anónimo").trim()

//   const url = API_URL
//       + "?modo=add"
//       + "&titulo=" + encodeURIComponent(tituloLimpio)
//       + "&autor=" + encodeURIComponent(autorLimpio)
//       + "&items=" + encodeURIComponent(JSON.stringify(items))

//   try {
//     await fetch(url)        // GET
//     await cargarRecetasDesdeAPI()
//   } catch (err) {
//     console.error("Error al agregar receta", err)
//   }
// }

// Agregar receta nueva a la hoja (usando GET con modo=add)
async function agregarRecetaAPI(titulo, textoLista) {
  const tituloLimpio = titulo.trim()
  const textoLimpio = textoLista.trim()
  const autorLimpio = (inputAutor.value || "Anónimo").trim()
  const prepLimpia  = (textareaPreparacion.value || "").trim()   // 👈 NUEVO

  if (!tituloLimpio || !textoLimpio) return

  let items = textoLimpio.includes("\n")
    ? textoLimpio.split("\n")
    : textoLimpio.split(",")

  items = items.map(t => t.trim()).filter(t => t !== "")
  if (!items.length) return

  // armamos la URL con los datos
  const url = API_URL
    + "?modo=add"
    + "&titulo=" + encodeURIComponent(tituloLimpio)
    + "&autor="  + encodeURIComponent(autorLimpio)
    + "&items="  + encodeURIComponent(JSON.stringify(items))
    + "&prep="   + encodeURIComponent(prepLimpia)   // 👈 NUEVO (puede ir vacío)

  try {
    await fetch(url)        // GET
    await cargarRecetasDesdeAPI()
  } catch (err) {
    console.error("Error al agregar receta", err)
  }
}


// ================== EVENTOS ==================

// // Click en "Agregar receta"
// buttonAgregar.addEventListener("click", () => {
//   agregarRecetaAPI(inputTitulo.value, textareaLista.value)
//   inputTitulo.value = ""
//   textareaLista.value = ""
//   inputAutor.value = ""
//   inputTitulo.focus()
// })

// Click en "Agregar receta"
buttonAgregar.addEventListener("click", () => {
  agregarRecetaAPI(inputTitulo.value, textareaLista.value)
  inputTitulo.value = ""
  textareaLista.value = ""
  inputAutor.value = ""
  textareaPreparacion.value = ""   // 👈 NUEVO
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
