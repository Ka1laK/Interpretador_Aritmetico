class InterpreteAritmetico {
    constructor() {
        this.variables = {};
    }

    tokenizar(expresion) {
        const tokens = [];
        let tokenActual = "";
        let i = 0;

        const agregarToken = () => {
            if (tokenActual) {
                tokens.push(tokenActual);
                tokenActual = "";
            }
        };

        while (i < expresion.length) {
            const char = expresion[i];
            if (/[a-zA-Z0-9_]/.test(char)) {
                tokenActual += char;
            } else if (["+","-","*", "/", "(", ")", "=", ",", "<", ">", " "].includes(char)) {
                agregarToken();
                if (char !== " ") {
                    tokens.push(char);
                }
            } else if (char === "." && tokenActual.match(/^\d+$/)) {
                tokenActual += char;
            } else if (char === "-" && (i + 1 < expresion.length) && (tokenActual === "" || tokens[tokens.length - 1] === "(")) {
                tokenActual += char;
            } else {
                agregarToken();
                tokenActual = char;
                agregarToken();
            }
            i++;
        }
        agregarToken();
        return tokens;
    }

    parsear(tokens) {
        const self = this;

        function parsearExpresion() {
            let resultado = parsearTermino();
            while (tokens.length && ["+", "-"].includes(tokens[0])) {
                const op = tokens.shift();
                if (op === "+") {
                    resultado = ["sumar", resultado, parsearTermino()];
                } else {
                    resultado = ["restar", resultado, parsearTermino()];
                }
            }
            return resultado;
        }

        function parsearTermino() {
            let resultado = parsearFactor();
            while (tokens.length && ["*", "/"].includes(tokens[0])) {
                const op = tokens.shift();
                if (op === "*") {
                    resultado = ["multiplicar", resultado, parsearFactor()];
                } else {
                    resultado = ["dividir", resultado, parsearFactor()];
                }
            }
            return resultado;
        }

        function parsearFactor() {
            const patronNumero = /^-?\d+(\.\d+)?$/;
            if (tokens[0] === "(") {
                tokens.shift();
                const resultado = parsearExpresion();
                if (tokens.shift() !== ")") throw new Error("!!! Falto cerrar los parentesis !!!\n");
                return resultado;
            } else if (tokens[0] in self.variables) {
                return ["var", tokens.shift()];
            } else {
                if (!patronNumero.test(tokens[0])) {
                    throw new Error("Se esperaba un numero, pero se encontro: '${tokens[0]}'\n");
                }
                return ["num", parseFloat(tokens.shift())];
            }
        }

        function parsearAsignacion() {
            const asignaciones = [];
            while (tokens.length) {
                const variable = tokens.shift();
                const operador = tokens.shift();
                let expr;
                if (operador === "=") {
                    expr = parsearExpresion();
                    asignaciones.push(["asignar", variable, expr]);
                } else if (["+=","-=","*=","/="].includes(operador)) {
                    expr = parsearExpresion();
                    switch (operador) {
                        case "+=":
                            asignaciones.push(["asignar_sumar", variable, expr]);
                            break;
                        case "-=":
                            asignaciones.push(["asignar_restar", variable, expr]);
                            break;
                        case "*=":
                            asignaciones.push(["asignar_multiplicar", variable, expr]);
                            break;
                        case "/=":
                            asignaciones.push(["asignar_dividir", variable, expr]);
                            break;
                    }
                } else {
                    throw new Error("Se esperaba '=' o un operador de asignacion incremental ...\n");
                }

                if (tokens[0] === ";") {
                    tokens.shift();
                } else {
                    break;
                }
            }
            return asignaciones;
        }

        function parsearCout() {
            tokens.shift();
            if (tokens.shift() !== "<" || tokens.shift() !== "<") throw new Error("Se esperaba: ' << '\n");
            const expr = parsearExpresion();
            return ["cout", expr];
        }

        const ast = [];
        while (tokens.length) {
            if (tokens[0] === "cout") {
                ast.push(parsearCout());
            } else if (/^[a-zA-Z_]\w*$/.test(tokens[0]) && tokens[1] === "=") {
                const asignaciones = parsearAsignacion();
                ast.push(...asignaciones);
            } else {
                ast.push(parsearExpresion());
            }
        }
        return ast;
    }

    evaluar(ast) {
        const self = this;
        const resultados = [];

        function evaluarNodo(nodo) {
            if (Array.isArray(nodo)) {
                const op = nodo[0];
                let izquierda, derecha, variable, valor, nombreVar, valorInc;
                switch (op) {
                    case "sumar":
                    case "restar":
                    case "multiplicar":
                    case "dividir":
                        izquierda = evaluarNodo(nodo[1]);
                        derecha = evaluarNodo(nodo[2]);
                        if (typeof izquierda !== "number" || typeof derecha !== "number") {
                            throw new Error("Operaciones aritmeticas --- solo permiten numeros\n");
                        }
                        switch (op) {
                            case "sumar":
                                return izquierda + derecha;
                            case "restar":
                                return izquierda - derecha;
                            case "multiplicar":
                                return izquierda * derecha;
                            case "dividir":
                                return izquierda / derecha;
                        }
                        break;
                    case "asignar":
                        variable = nodo[1];
                        valor = evaluarNodo(nodo[2]);
                        if (typeof valor !== "number") {
                            throw new Error("La asignacion solo permite numeros !!!\n");
                        }
                        self.variables[variable] = valor;
                        return valor;
                    case "asignar_sumar":
                    case "asignar_restar":
                    case "asignar_multiplicar":
                    case "asignar_dividir":
                        nombreVar = nodo[1];
                        valorInc = evaluarNodo(nodo[2]);
                        if (typeof valorInc !== "number") {
                            throw new Error("La asignación incremental solo permite numeros !!!\n");
                        }
                        if (!(nombreVar in self.variables)) {
                            throw new Error("!!! Variable '${nombreVar}' no definida !!!\n");
                        }
                        switch (op) {
                            case "asignar_sumar":
                                self.variables[nombreVar] += valorInc;
                                break;
                            case "asignar_restar":
                                self.variables[nombreVar] -= valorInc;
                                break;
                            case "asignar_multiplicar":
                                self.variables[nombreVar] *= valorInc;
                                break;
                            case "asignar_dividir":
                                self.variables[nombreVar] /= valorInc;
                                break;
                        }
                        return self.variables[nombreVar];
                    case "var":
                        if (!(nodo[1] in self.variables)) {
                            throw new Error("!!! Variable:  '${nodo[1]}' no definida\n");
                        }
                        return self.variables[nodo[1]];
                    case "num":
                        return nodo[1];
                    case "cout":
                        const resultadoExpr = evaluarNodo(nodo[1]);
                        if (typeof resultadoExpr === "number") {
                            resultados.push({ tipo: "cout", valor: resultadoExpr });
                        } else if (typeof resultadoExpr === "string" && resultadoExpr in self.variables) {
                            resultados.push({ tipo: "cout", valor: self.variables[resultadoExpr] });
                        } else {
                            resultados.push({ tipo: "error", valor: `Error: expresion '${resultadoExpr}' no valida.` });
                        }
                        return null;
                }
            } else {
                return nodo;
            }
        }

        for (const nodo of ast) {
            const resultado = evaluarNodo(nodo);
            if (resultado !== null && resultado !== undefined) {
                resultados.push({ tipo: "--> Resultado: ", valor: resultado });
            }
        }

        return resultados;
    }

    

    validarExpresion(expresion) {
        const simboloInvalido = /\/\s*$/;
        const divisionEntreCero = /\/\s*0/;  
        if (simboloInvalido.test(expresion)) {
            throw new Error("EXPRESION INCOMPLETA: no se puede terminar con una operacion de division\n");
        }
        if (divisionEntreCero.test(expresion)) {
            throw new Error("!!!! EYYY, No se puede dividir entre cero !!!!\n");
        }
    }

    interpretar(expresion) {
        this.validarExpresion(expresion);
        const tokens = this.tokenizar(expresion);
        const ast = this.parsear(tokens);
        return this.evaluar(ast);
    }
}

function interpretarCodigo() {
    const interprete = new InterpreteAritmetico();
    const entradaCodigo = document.getElementById("entradaCodigo");
    const codigo = entradaCodigo.value.trim();
    const elementoSalida = document.getElementById("salida");
    
    elementoSalida.textContent = "";

    const lineas = codigo.split("\n");
    let coutSalidas = "";

    for (const linea of lineas) {
        const lineaRecortada = linea.trim();

        if (lineaRecortada === "") {
            continue;
        }
        try {
            const resultados = interprete.interpretar(lineaRecortada);
            for (const resultado of resultados) {
                if (resultado.tipo === "cout") {
                    coutSalidas += `${resultado.valor}\n`;
                } else if (resultado.tipo === "error") {
                    elementoSalida.textContent += `Error para '${lineaRecortada}': ${resultado.valor}\n`;
                }
            }
        } catch (error) {
            elementoSalida.textContent += `Error para '${lineaRecortada}': ${error.message}\n`;
        }
    }

    elementoSalida.textContent += coutSalidas;
}
