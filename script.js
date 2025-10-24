document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const validateButton = document.getElementById('validateButton');
    const resultDiv = document.getElementById('result');

    validateButton.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file) {
            displayError("Por favor, seleccione un archivo antes de validar.");
            return;
        }
        validateFile(file);
    });

    function displayError(message, details = null) {
        resultDiv.className = 'result-container error';
        let html = `<h3>Archivo Rechazado</h3><p>${message}</p>`;
        if (details) {
            html += '<ul>';
            for (const key in details) {
                html += `<li><strong>${key}:</strong> ${details[key]}</li>`;
            }
            html += '</ul>';
        }
        resultDiv.innerHTML = html;
    }

    function displaySuccess(message) {
        resultDiv.className = 'result-container success';
        resultDiv.innerHTML = `<h3>Archivo Aprobado</h3><p>${message}</p>`;
    }

    async function validateFile(file) {
        // 1. Validación del nombre del archivo
        const fileName = file.name;
        const nameRegex = /^TVWXYB([1-4])\d{8}\.txt$/;
        if (!nameRegex.test(fileName)) {
            displayError("El nombre del archivo no cumple con el formato 'TVWXYBZDDMMAAAA.txt' o el código de balance (Z) no está entre 1 y 4.");
            return;
        }

        const fileContent = await file.text();
        const lines = fileContent.split(/\r?\n/);

        // 2. Validación de línea vacía al final
        if (lines.length > 1 && lines[lines.length - 1] === '') {
            displayError("El archivo no puede terminar con una línea vacía. El número de filas útiles no es correcto.");
            return;
        }

        // 3. Validación de la primera línea (línea de control)
        const controlLine = lines[0];
        if (!controlLine) {
            displayError("El archivo está vacío o la primera línea no existe.");
            return;
        }

        const controlValues = controlLine.split('\t');
        if (controlValues.length !== 4) {
            displayError(`La primera línea debe tener 4 valores separados por tabulador. Se encontraron ${controlValues.length}.`);
            return;
        }

        const [controlCode, cutOffDate, declaredRowsStr, declaredTotalStr] = controlValues;

        // 3.1. Código de control
        const expectedCode = fileName.substring(0, 5);
        if (controlCode !== expectedCode) {
            displayError(`El primer valor de la línea de control ('${controlCode}') no coincide con el esperado ('${expectedCode}').`);
            return;
        }

        // 3.2. Formato de fecha
        const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
        if (!dateRegex.test(cutOffDate)) {
            displayError(`La fecha de corte ('${cutOffDate}') no cumple con el formato DD/MM/YYYY.`);
            return;
        }

        // 3.3. Número de filas y total monetario (validar que sean números)
        const declaredRows = parseInt(declaredRowsStr, 10);
        const declaredTotal = parseFloat(declaredTotalStr);

        if (isNaN(declaredRows)) {
            displayError(`El número de filas declarado ('${declaredRowsStr}') no es un número válido.`);
            return;
        }
        if (isNaN(declaredTotal)) {
            displayError(`El total monetario declarado ('${declaredTotalStr}') no es un número válido.`);
            return;
        }

        // 4. Validación de filas útiles
        const usefulLines = lines.slice(1).filter(line => line.trim() !== '');
        if (usefulLines.length !== declaredRows) {
            displayError(`El número de filas útiles (${usefulLines.length}) no coincide con el número declarado en la primera línea (${declaredRows}).`);
            return;
        }

        let calculatedTotal = 0;
        const groupSubtotals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        for (let i = 0; i < usefulLines.length; i++) {
            const line = usefulLines[i];
            // 5. Validación de separador
            if (!line.includes('\t')) {
                displayError(`La línea ${i + 2} no usa tabulador como separador.`);
                return;
            }

            const parts = line.split('\t');
            if (parts.length < 2) { // Asumimos al menos 2 columnas: código y valor
                displayError(`La línea ${i + 2} no tiene el número esperado de valores.`);
                return;
            }

            const groupCode = parseInt(parts[0], 10);
            const subtotal = parseFloat(parts[1]);

            if (isNaN(groupCode) || isNaN(subtotal)) {
                displayError(`La línea ${i + 2} contiene valores no numéricos para el código de grupo o el subtotal.`);
                return;
            }
            
            // 6. Suma de subtotales
            if (groupCode >= 1 && groupCode <= 5) {
                calculatedTotal += subtotal;
                if (groupSubtotals.hasOwnProperty(groupCode)) {
                    groupSubtotals[groupCode] += subtotal;
                }
            }
        }

        // Comparación final de totales
        // Usar una tolerancia para comparar flotantes
        if (Math.abs(calculatedTotal - declaredTotal) > 0.001) {
            displayError("La suma de los subtotales de los grupos principales no coincide con el total monetario de la primera línea.", {
                "Total Declarado": declaredTotal.toFixed(2),
                "Suma Calculada": calculatedTotal.toFixed(2),
                "Diferencia": (calculatedTotal - declaredTotal).toFixed(2),
                "Subtotal Grupo 1": groupSubtotals[1].toFixed(2),
                "Subtotal Grupo 2": groupSubtotals[2].toFixed(2),
                "Subtotal Grupo 3": groupSubtotals[3].toFixed(2),
                "Subtotal Grupo 4": groupSubtotals[4].toFixed(2),
                "Subtotal Grupo 5": groupSubtotals[5].toFixed(2),
            });
            return;
        }

        // Si todas las validaciones pasan
        displaySuccess("El archivo ha sido validado y cumple con todos los criterios establecidos.");
    }
});
