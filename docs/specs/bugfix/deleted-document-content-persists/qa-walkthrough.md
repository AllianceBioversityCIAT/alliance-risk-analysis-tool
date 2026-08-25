# Guía de QA manual — T-008

> **Nota de idioma:** esta guía está en español a propósito. El resto del spec está en inglés por convención del repo, pero este documento existe para ser *ejecutado a mano* por quien lo lee, y una guía que no se entiende no sirve de gate.

---

## 1. Qué estás verificando, y por qué a mano

El bug: **borrar un documento no quitaba su contenido del análisis ni del visor.** Ya está arreglado en código y hay 583 tests automáticos en verde.

Pero tres tipos de fallo **ningún test puede verlos**, por razones estructurales:

| | Qué es | Por qué el test no lo ve |
|---|---|---|
| **D4** | Borras en la pantalla de subida, el contenido viejo sigue en la pantalla del Gap Detector | Son dos pantallas con **cachés separadas**. Un test unitario puede verificar que se pide limpiar la caché; no puede verificar el efecto de una pantalla sobre la otra |
| **D6** | El aviso aparece, pero no se entiende o no dice qué hacer | Un test puede verificar que el texto se renderizó. No puede verificar que se **entienda** |
| **D8** | Después de borrar, los campos Core-10 y la pista de país siguen describiendo el documento borrado hasta el siguiente análisis | Fuera del alcance del fix — pero hay que confirmar que el residuo está **acotado** a esas superficies |

Más una línea del código que quedó **sin cobertura automática** (el paso 8 la cubre).

**Esto no es formalismo.** El log del proyecto tiene una lección, `KZ-008`, que existe porque esta caminata se saltó en un spec anterior y **cuatro bugs reales** llegaron a "listo para archivar" pasando por delante de tests verdes.

**Tiempo estimado:** 30–45 minutos.

---

## 2. Arranque

Ya verifiqué tu entorno: PostgreSQL corriendo, `packages/api/.env` presente, 9 migraciones aplicadas, 7 assessments y usuarios sembrados. **No necesitas la instalación inicial.**

```bash
cd /Users/danielagomezayalde/Documents/Github/CGIAR/alliance-risk-analysis-tool

# 1. Compilar el paquete compartido (cambió en este spec — es obligatorio antes de arrancar)
pnpm --filter @alliance-risk/shared build

# 2. Arrancar API (:3001) y Web (:3000)
pnpm dev
```

**Comprobación de salud** (en otra terminal):

```bash
curl http://localhost:3001/api        # → {"status":"ok"}
```

Y abre http://localhost:3000 — debe salir la pantalla de login.

### Dos cosas que necesitas activas

1. **Credenciales AWS.** El stack local usa Cognito real para el login, S3 real para los archivos y Bedrock real para parsear y analizar. Si tu `AWS_PROFILE` no tiene sesión activa, los documentos no van a parsear. Renuévala antes de empezar.
2. **Las DevTools del navegador abiertas**, en la pestaña **Network**. Los pasos 1, 3 y 5 se verifican ahí, no solo mirando la pantalla.

### Si necesitas resembrar

```bash
cd packages/api && npx tsx prisma/seed.ts && cd ../..
```

⚠️ **No uses** `npx --prefix packages/api tsx prisma/seed.ts`. Falla con `ERR_MODULE_NOT_FOUND` — `--prefix` elige de qué paquete sale el binario, no desde dónde se resuelve la ruta del archivo. Está documentado como `KZ-010`.

---

## 3. Preparación

Necesitas **dos documentos con contenido claramente distinto** — idealmente que hablen de negocios o países diferentes, para que puedas distinguir de un vistazo cuál está viendo la pantalla. Llámalos mentalmente **A** y **B**.

1. Crea un assessment nuevo en modo **subida de documentos** (UPLOAD).
2. Sube el documento **A**.
3. Espera a que termine de parsear y a que el análisis corra solo (se encadena automáticamente).
4. Cuando el Gap Detector muestre el contenido de A y los campos llenos, estás listo.

---

## 4. Los 9 pasos

En cada uno: **qué haces**, **qué deberías ver**, y **qué sería un bug**. Anota el resultado de cada paso.

---

### Paso 1 — Borrar y reemplazar *(el bug que reportaste)*

**Haces:** desde el Gap Detector, entra a *Manage Documents*. Borra **A**. Sube **B**. Espera a que parsee y a que el análisis vuelva a correr.

**Deberías ver:** el visor muestra **solo el contenido de B**. Ningún rastro de A — ni su texto, ni su nombre de archivo en los separadores.

**Sería un bug:** aparece cualquier parte de A, o los dos mezclados. *Eso es literalmente el bug original.*

> **Además, este paso cubre D4.** Borraste en `/assessments/upload` y estás verificando en `/assessments/gap-detector` — dos pantallas, dos cachés. Ningún test automático puede ver este cruce.

> **Nuevo (T-009): el estado "en curso".** Mientras B parsea y el análisis nuevo corre, es normal ver *"Analysing your documents…"* en vez del aviso de desactualizado — aunque técnicamente el análisis viejo ya no aplica (borraste A), mostrar "está desactualizado" mientras el remedio está corriendo delante de tus ojos no ayuda a nadie. Si en algún punto de esa ventana ves el aviso de *"out of date"* en lugar de *"Analysing…"*, anótalo — es la regresión exacta que encontró T-008.

---

### Paso 2 — Borrar sin reemplazar

> **Corregido (T-009).** La versión anterior de este paso decía "borra el documento" sobre un assessment sin especificar cuántos documentos tiene. Si es el **único** documento, `design.md` §8.1 y FR-DDP-003 Sc 3 exigen el estado de **cero documentos** — *"No documents on this assessment."* — no el aviso de desactualizado. Los pasos 2 y 4 chocaban exactamente por eso. Este paso ahora usa explícitamente un assessment con **más de un documento**; el paso 4 sigue cubriendo el caso del último documento.

**Haces:** usa un assessment ya analizado que tenga **al menos dos documentos** (por ejemplo, el mismo del Paso 1 tras subir B, o sube un segundo documento C antes de empezar). Entra a *Manage Documents*, borra **uno solo** de los documentos (no todos), y **no subas nada**. Vuelve al Gap Detector.

**Deberías ver:** no aparece nada del documento borrado. El panel del documento **sigue ahí** (no desaparece) y muestra:

> *"This analysis is out of date — it doesn't reflect the documents currently on this assessment."*

con un botón **"Re-analyse now"**.

**Sería un bug:** sigue viéndose el contenido del documento borrado, o el panel derecho **desaparece** dejando la pantalla en una sola columna sin explicación.

> **Ojo con el nuevo estado "en curso" (T-009).** Borrar sin reemplazar **no** dispara ningún trabajo de IA (NFR-DDP-011) — no hay parseo ni re-análisis en marcha — así que **no** deberías ver *"Analysing your documents…"* en ningún momento de este paso. Si lo ves, es un bug: nada debería estar "en vuelo" después de un borrado sin reemplazo. (El estado "en curso" sí es esperado en los Pasos 1 y 5, donde subes un documento nuevo — ver sus notas.)

> **Aquí evalúas D6.** Ponte en el lugar de alguien que no trabajó en esto: *¿el mensaje explica qué pasó y qué hacer?* Si tu reacción es "¿y ahora qué hago?", el texto falló aunque el código funcione. **Anota tu impresión honesta** — es el único gate que tiene.

---

### Paso 3 — El polling se detiene

**Haces:** quédate en esa pantalla ~60 segundos. En **Network**, filtra por `merged-content`.

**Deberías ver:** las peticiones **paran**. No siguen apareciendo cada 5 segundos indefinidamente.

**Sería un bug:** siguen apareciendo para siempre.

> **Ojo con el tiempo.** Producción reintenta una vez, así que cada intento son **dos** peticiones HTTP. Si el estado desactualizado se alcanza sin contenido previo, el tope es de 60 intentos — puede tardar más de los 5 minutos que dice el comentario del código. Lo que verificas aquí es que **paran**, no exactamente cuándo.

> **Nuevo (T-009): esto asume que nada está "en curso".** El polling ahora también sigue mientras `analysisInFlight` sea verdadero — es la única forma en que la pantalla se entera de que un análisis encadenado por el servidor terminó, ya que ese job nunca llega al navegador por ninguna respuesta HTTP. En este paso (Paso 2, borrar sin reemplazar) eso no debería aplicar, porque borrar no dispara ningún trabajo — por eso el polling para igual. Si quieres ver el polling *seguir* legítimamente, quédate en el Paso 5 mientras el análisis nuevo corre.

---

### Paso 4 — Borrar el último documento

**Haces:** en un assessment con un solo documento, bórralo y vuelve al Gap Detector.

**Deberías ver:** *"No documents on this assessment."* con un botón **"Manage Documents"**.

**Sería un bug:** ofrece **"Re-analyse now"**. Re-analizar sin documentos no puede producir contenido — ofrecerlo es prometer algo imposible.

---

### Paso 5 — Agregar un documento **no** debe ocultar el análisis ⭐

**Este es el paso más importante de la lista.** Tres diseños distintos de este fix fallaron aquí, y el tercero falló específicamente durante la ventana del análisis.

**Haces:** en un assessment **ya analizado y funcionando**, sube un segundo documento. **Mira el panel del documento durante todo el proceso** — mientras sube, mientras parsea, **y mientras corre el análisis nuevo**.

**Deberías ver:** el análisis existente **sigue visible y legible todo el tiempo**. Y cuando el análisis nuevo termina, la pantalla se actualiza sola.

> **Nuevo (T-009): un indicador, no un spinner que tapa todo.** Mientras el análisis nuevo corre, es correcto ver un indicador pequeño y discreto tipo *"Analysing the latest documents…"* junto al contenido — el contenido en sí **no debe desaparecer ni taparse**. Eso es distinto del estado de pantalla completa *"Analysing your documents…"* que viste en el Paso 1 (ese aparece cuando **todavía no hay contenido que mostrar**; aquí ya lo hay).

**Sería un bug, cualquiera de estos:**
- el panel se pone en blanco o muestra un spinner en cualquier momento
- dice que el análisis está desactualizado (**no lo está** — agregaste, no borraste)
- termina el análisis y la pantalla **no** se actualiza hasta que recargas a mano
- el indicador de "en curso" **reemplaza** el contenido en vez de acompañarlo

> No sueltes el paso cuando el documento termine de parsear. **La ventana que falló la última vez es mientras corre el análisis**, después del parseo.

---

### Paso 6 — Guardar un campo no debe vaciar el panel

**Haces:** en un assessment funcionando, edita y guarda un campo del Gap Detector. Mira el panel del documento.

**Deberías ver:** el contenido sigue ahí.

**Sería un bug:** se vacía.

> Es la misma clase de fallo del paso 5, pero en el camino que más se transita: guardar un campo dispara un re-análisis con retardo.

---

### Paso 7 — El residuo acotado (D8)

**Haces:** vuelve al estado del paso 2 (contenido retenido). Mira los **campos Core-10** y cualquier **pista de país** en la misma pantalla.

**Deberías ver:** puede que **todavía describan el documento borrado**. Eso es **esperado y está fuera del alcance de este fix** — los campos se recrean en la siguiente corrida.

**Lo que verificas:** que el residuo esté **acotado a esas superficies** y que **desaparezca después de re-analizar**.

**Sería un bug:** el residuo aparece en sitios que no son esos, o **sigue ahí después** de un re-análisis exitoso.

---

### Paso 8 — El remedio funciona ⭐

**Haces:** desde el estado retenido, aprieta **"Re-analyse now"**.

**Deberías ver, en este orden:**
1. El botón se **deshabilita** y pasa a decir *"Re-analysing…"* — y **se queda así toda la corrida**, no solo un instante
2. Al terminar, el aviso **desaparece solo**, sin recargar la página
3. La lista de campos sigue teniendo **10 campos, no 20**

**Sería un bug, cualquiera de estos:**
- el botón se re-habilita a mitad de la corrida (permite encolar corridas duplicadas y gastar Bedrock de más)
- el aviso sigue ahí hasta que recargas a mano
- aparecen **20 campos** en vez de 10

> **Este paso es el único gate de una línea de código sin cobertura automática.** Al revisarlo se comprobó que revertir esa línea deja todos los tests en verde. Si algo de esto falla, no hay red debajo.

---

### Paso 9 — Un borrado que falla no debe mentir

**Haces:** desconecta la red (modo avión, o `Offline` en DevTools → Network). Intenta borrar un documento.

**Deberías ver:** aparece un aviso de error, y **el documento sigue en la lista**.

**Sería un bug:** el documento desaparece de la lista igual. Eso es peor que el bug original — le hace creer al usuario que borró algo que sigue ahí.

---

### Extra — El primer render *(decisión OQ-3)*

**Haces:** entra en frío al Gap Detector de un assessment en modo subida.

**Deberías ver:** el layout arranca en **dos columnas**, con un placeholder a la izquierda que se llena al cargar.

**Qué opinar:** antes arrancaba en una columna y saltaba a dos. Decidí mantener el panel montado siempre, porque es lo que hace que el aviso tenga dónde vivir. **Si el placeholder te resulta molesto, dilo** — se revierte en una línea.

---

## 5. Cómo anotar el resultado

| Paso | Resultado | Nota |
|---|---|---|
| 1 — borrar y reemplazar | ☐ pasa / ☐ falla | |
| 2 — borrar sin reemplazar (≥2 documentos) | ☐ pasa / ☐ falla | ¿se entiende el mensaje? ¿NO aparece "Analysing…"? |
| 3 — el polling para | ☐ pasa / ☐ falla | |
| 4 — último documento | ☐ pasa / ☐ falla | |
| 5 — agregar no oculta ⭐ | ☐ pasa / ☐ falla | ¿durante el análisis también? |
| 6 — guardar campo | ☐ pasa / ☐ falla | |
| 7 — residuo acotado | ☐ pasa / ☐ falla | |
| 8 — el remedio ⭐ | ☐ pasa / ☐ falla | ¿botón bloqueado toda la corrida? |
| 9 — borrado fallido | ☐ pasa / ☐ falla | |
| extra — primer render | ☐ ok / ☐ molesta | |

Pásame la tabla llena. Con eso cierro T-008 en `execution.md` y el spec queda listo para `/akili-validate` y `/akili-archive`.

**Si algo falla:** dime el número del paso y qué viste. Cada paso apunta a la tarea que lo produjo, así que sé exactamente dónde mirar — no hay que investigar desde cero.
