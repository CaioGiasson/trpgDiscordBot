// --------------------------------------------------------------------------------------------------------------
// 
// BOT DE ROLAGEM DE DADOS PARA DISCORD, por Caio Felipe Giasson
// 
// Instruções:
// Na pasta com esse arquivo deve ter outro arquivo chamado auth.json, cujo conteúdo é:
// 
// 		{
//			"token": "ABCDEFGHIJKLMNOPQRSTUVXY.ABCDEF.ABCDEFGHIJKLM-L-ABCDEFGHIJK"
//		}
//
// Claro, ali você substitui essa string pela token do seu bot, que já deve ter sido criado no painel do Discord
// Endereço do painel: 		https://discordapp.com/developers/applications/
//
// Depois disso, com esses dois arquivos na pasta, é só dar um npm install e depois node trpg_bot.js
//
// --------------------------------------------------------------------------------------------------------------

var Discord = require('discord.io');
var mysql = require('mysql');
var auth = require('./auth.json');

// Aqui tem os dados e a conexão do mysql
const condata 			= { host: "127.0.0.1", user: "DB_USER", password: "DB_PASS", database: "DB_NAME" };
con						= mysql.createConnection( condata );
con.connect();

// Aqui o bot é inicializado
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});

// Aqui é só um listener no evento 'ready', quando ele acontece dá um aviso na console de que deu certo a conexão
// Se der console log no evt, caso tenha erro, consegue ver qual erro de conexão deu
bot.on('ready', function (evt) {
    console.log( `Conectou como ${bot.username} - ${bot.id}` );
});

bot.on('message', function (user, userID, channelID, message, evt) {

	// O userID do if abaixo é do próprio bot.
	// Se não colocar esse return abaixo, o bot vai responder as próprias mensagens
	if ( userID==99999999999999999999 ) return;
	
	// Só por que eu gosto mais da palavra comando do que message, e queria deixar o argumento conforme encontrei na doc do modulo
    var comando = message;

	// Regex pra identificar se tem uma rolagem ali, ou seja, algo no modelo XdY, sendo X dados de Y, podendo ter mais coisas além disso
    if ( comando.match(/[0-9]+d[0-9]+/g)!=null ){
		
		// O bot recebe todas as mensagens, mesmo as que não começam com ! ou com /
		// Pra "resolver" isso, temos que filtrar pra ele só "prestar atenção" nas que começam com ! ou /
		// Além disso, eu aproveito e já tiro esse caractere, por que ele só serve pra identiricar que a mensagem não deve ser ignorada
        if ( comando[0] == `!` || comando[0] == `/` ) comando = comando.substring(1);
        else return;

		// Abaixo eu estou tratando vários tipos de rolagem. Pode ser com !, /, !r, /r, !roll e /roll
		// !1d20+15
		// /1d20+15
		// !r 1d20+15
		// /roll 1d20+15
		// etc
        if ( comando.indexOf(`roll `)>-1 ) 
            comando = comando.replace(/roll /g, ``);

        if ( comando.indexOf(`roll`)>-1 ) 
			comando = comando.replace(/roll/g, ``);
			
		if ( comando.indexOf(`r `)>-1 ) 
            comando = comando.replace(/r /g, ``);

		if ( comando.indexOf(`r`)>-1 ) 
            comando = comando.replace(/r/g, ``);

		// Quando tem espaço, é um "extra info" da rolagem
		// Exemplo: 
		// !r 1d20+15 furtividade
		if ( comando.indexOf(` `)>0 ) comando = comando.split(` `)[0];
		
		// Agora usei regex pra separar quando tem rolagens múltiplas
		// Exemplo: 
		// !r 1d8+2d6+1d4-3
		// No array "dados" eu guardo cada rolagem separada (usando split), ou seja: [ "1d8", "2d6", "1d4", "3" ]
		// No array "sinais" eu guardo só os intermediários, ou seja: [ "+", "+", "-" ]
        const dados = comando.split(/[+-]/g);
        const sinais = comando.match(/[+-]/g);

        // Aqui eu rolo o índice 0, ou seja, a primeira rolagem
        var rolagens = doRoll(dados[0]) ;

        // Aqui eu rolo os demais índices, quando eles existem
        for ( k=1 ; k<dados.length ; k++ ) rolagens = rolagens.concat( doRoll( dados[k], sinais[k-1] ) );

        // Calculando a soma
        var soma = 0;
        for ( i in rolagens ) soma += rolagens[i];

		// Obtendo o nome do jogador. Se ele tiver um nick eu uso o nick, senão o username
		const name = evt.d.member.nick ? evt.d.member.nick : evt.d.author.username;

		// Formatando a mensagem com o nome, o resultado final e depois o resultado das parciais (usando a função theRolls)
        const resultado = `${name} rolou ${comando}\nResultado: ${soma} ${theRolls(rolagens)}`;

		// Enviando finalmente o resultado no mesmo canal em que o comando foi recebido
        bot.sendMessage({
            to: channelID,
            message: resultado
		});
		
		// Essa função salva no banco de dados o resultado, para auditoria futura (se for o caso)
		saveResult( evt.d.id, name, comando, JSON.stringify(rolagens), d20 );
    }
});

// Função pra salvar no banco
const saveResult = function(user_id, user_name, msg, result, d20 ){
	const q = `INSERT INTO rolls (user_id, user_name, msg, result, d20, rolltime, chat_id, chat_name)
		VALUES (${user_id}, '${user_name}', '${msg}', '${result}', '${d20}', NOW(), 0, 'DISCORD');`;
	con.query(q);
}

// Função que faz cada rolagem individual, e já traz o resultado final dessa rolagem, aplicando o sinal
// Entende-se por rolagem individual cada parcial citada na rolagem. 
// Se o jogador rolar !r 1d8+3d6 então há duas rolagens individuais (1d8 e 3d6)
const doRoll = function(dado, sinal=`+`){
    const s = sinal==`+` ? 1 : -1;
    if ( typeof dado != `string` ) return dado*s;
    if ( dado.indexOf(`d`)==-1 ) return dado*s;

    const [n,d] = dado.split(`d`);
    const resultados = [];

    for ( i=0 ; i<n ; i++ ) 
        resultados.push( s * ( parseInt(Math.random()*d) + 1 ) );

	if ( d==20 && resultados.length==1 ) global.d20 = resultados[0];
	else global.d20 = 0;

    return resultados;
};

// Essa função apenas recebe um array com o resultado das rolagens, e printa na forma extensa, retornando algo como: (5+3-2)
const theRolls = function(rolls){
    var result = ``;
    for ( i in rolls ) result += rolls[i]<0 ? rolls[i] : `+${rolls[i]}`;
    result = result.substring(1);
    return `(${result})`;
};
