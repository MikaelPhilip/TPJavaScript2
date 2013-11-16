'use strict';
 
/**
* Web Scraper
*/

/** Améliorations par rapport au modéle de base:
*
*Plus d'infos pour chaque url trouvé: Le titre de la page apparait si elle existe (A noter que cette amélioration à un probleme: malgré l'ordre d'execution dans le code, l'affichage des titres ce fait aprés la liste des liens trouvé (chaque titre devrait être en dessous du lien qui correspond, corrigable avec une API).
*
*Des stats pour les recherches: nombres de résultats trouvés, temps d'execution de la recherche.
*
*Séparation des url des sites et des url qui pointent vers des images: suivant le choix fait on affichera que les url qui amménes à un site web ou que les url des images. Tout cela dans le but d'éviter, par exemple, que notre recherche soit "parasitée" par des listes d'images quand on veut que des sites web.
*
*Ajout de la possibilité de sauvegarder sur une base de donnée les résultats d'une recherche mais aussi le contenu html des pages si l'on souhaite plus d'informations supplémentaires.
*
*Ajout d'un controle pour les recherches: On a trois options supplémentaires lors du lancement de la recherche pour indiquer:
*Si on cherche des images ou des sites 
*Si on veut voir les infos supplémentaires sur la recherche ou juste la liste des liens 
*Si l'on souhaite suavegarder la recherche dans une BDD.
*
*ADD: Ajout fait pour le tp.
*
*MODIFY: Modification effectuée pour le tp.
*/
 
// Url regexp from http://daringfireball.net/2010/07/improved_regex_for_matching_urls
var EXTRACT_URL_REG = /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/gi;
var PORT = 3000;
 
var request = require('request');
// See: http://expressjs.com/guide.html
var express = require('express');
var app = express();
var EventEmitter = require('events').EventEmitter;

// We create a global EventEmitter (Mediator pattern: http://en.wikipedia.org/wiki/Mediator_pattern )
var em = new EventEmitter();
/**
* Remainder:
* queue.push("http://..."); // add an element at the end of the queue
* queue.shift(); // remove and get the first element of the queue (return `undefined` if the queue is empty)
*
* // It may be a good idea to encapsulate queue inside its own class/module and require it with:
* var queue = require('./queue');
*/
var queue = [];

// ADD : modules nécessaires pour l'affichage des titres et pour la sauvegarde des recherches dans une bdd 
var http = require('http');
var url = require('url');
var mongoose = require('mongoose');

// ADD: Variables pour compter le nb de résultats et la durée de la recherche 
var nbResu = 0; // On n'utilise pas la propriété queue.length à la place car celle-ci accumule l'ensemble des resultats des différentes recherches donc elle indiquerait le nb de résultat de toutes les recherches et pas juste celui de la derniére recherche
var start = new Date().getTime();  
var EXTRACT_IMG_REG = /\.(png|jpg|gif|bmp|ico)$/; //Expression réguliére pour trier les liens finissant par des noms d'extension d'images

// ADD: Création des schémas c'est à dire la création d'une structure qui est l'équivalent d'une table sql pour enregistrer les résultats
var results = new mongoose.Schema({ // Cette table sauvegardera que les liens trouvés
  link : { type : String} 
});
var html_contents = new mongoose.Schema({ // Cette table sauvegardera les liens trouvés et le contenu des pages de chaque liens
  link : { type : String},
  content : { type : String}
});

// ADD: Création des modéles : c'est à dire des objets qui vont servir à rajouter des données dans la table
var result = mongoose.model('resultats', results);
var html_content = mongoose.model('content', html_contents);


/**
* Get the page from `page_url`
* @param {String} page_url String page url to get
*
* `get_page` will emit
*/
/* ADD: Fonction qui permet d'indiquer et de se connecter sur la BDD*/
//See: http://atinux.developpez.com/tutoriels/javascript/mongodb-nodejs-mongoose/
function init_bdd(){
mongoose.connect('mongodb://localhost/Spider', function(err) {
  if (err) { throw err; }
});
}


/* ADD: Fonction qui coupe la connexion à la BDD*/
function stop_bdd(){
mongoose.connection.close();
}
/* MODIFY: get_page est modifiée de façon à acceuillir trois nouveaux arguments booléen : 
*"infos" permet de dire si on veut voir les détail sur la recherche.
*"img" permet d'indiquer si on cherche uniquement des images.
*"sauv" indique si l'on veut sauvegarder dans une bdd la recherche. */
function get_page(page_url,infos,img,sauv){
em.emit('page:scraping', page_url);

//Initialisation des variables des stats des recherches (pour le calcul de la durée de la recherche)
start = new Date().getTime();  
nbResu =0;
// See: https://github.com/mikeal/request
request({
url:page_url,
}, function(error, http_client_response, html_str){
// ADD: Si on veut sauvegarder la recherche on appelle la méthode qui établi une connexion avec la bdd
if(sauv){
init_bdd();
}
if(error){
em.emit('page:error', page_url, error);
return;
}
// ADD: Deux cas: si on veut les infos ou non
// On rajoute les trois arguments , pour l'evenement, qui permet d'indiquer si on affiche que les images, si l'on souhaite les infos et si l'on veut sauvegarder dans une bdd la recherche
em.emit('page', page_url, html_str, img, infos, sauv);
// Ajout d'un appel vers un evenement si "infos" est vrai
if(infos){
em.emit('search:stat',page_url, html_str);
}
if(sauv){
stop_bdd();
}
});
}
 
/**
* Extract links from the web pagr
* @param {String} html_str String that represents the HTML page
*
* `extract_links` should emit an `link(` event each
*/
// MODIFY: ajout de deux argument "img" et "infos"
function extract_links(page_url, html_str, img, infos,sauv){
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match
// "match" can return "null" instead of an array of url
// So here I do "(match() || []) in order to always work on an array (and yes, that's another pattern).
(html_str.match(EXTRACT_URL_REG) || []).forEach(function(url){
// see: http://nodejs.org/api/all.html#all_emitter_emit_event_arg1_arg2
// Si l'on veut que les images et que le lien pointe vers une image où si l'on veut pas les images et que le lien n'est pas une image alors on le rajoute à la liste des liens trouvés
if((img && url.match(EXTRACT_IMG_REG))||(!img && !url.match(EXTRACT_IMG_REG))){
em.emit('url', page_url,html_str, url, sauv);
if (infos){
em.emit('search:info', url, sauv);
}
}
});
}
 
 
function handle_new_url(from_page_url, from_page_str, url){
// Add the url to the queue
queue.push(url);
}
 
 
em.on('page:scraping', function(page_url){
console.log('Loading... ', page_url);
});


// Listen to events, see: http://nodejs.org/api/all.html#all_emitter_on_event_listener
em.on('page', function(page_url, html_str){
console.log('We got a new page!', page_url);
});


em.on('page:error', function(page_url, error){
console.error('Oops an error occured on', page_url, ' : ', error);
});


em.on('page', extract_links);


em.on('url', function(page_url, html_str, url,sauv){
console.log('We got a link! ', url);
// ADD: Incrementetation du nombre de résultat
nbResu++;
// ADD: Si on a prévus de sauvegarder alors on enregistre une nouvelle ligne
if(sauv){
// On crée une instance pour enregistrer la donnée
var line = new result();
line.link= url;
line.save(function (err) {
  if (err) { throw err; }
});
}
});


em.on('url', handle_new_url);


/* ADD: Ajout des nouveaux évenements */
em.on('search:info', function(newUrl,sauv){
// See: http://nodejs.org/docs/v0.4.11/api/http.html#http.ServerRequest
// On doit à partir de l'url obtenu récupérer le chemin et le nom d'hote sans le protocole devant

// Recuperer le chemin
var parseUrl = url.parse(newUrl,true); // On se sert d'un module pour récuperer le chemin
var pathUrl = parseUrl.pathname;

// Le nom d'hote sans le protocole
var posf= newUrl.indexOf(parseUrl.pathname); // On détermine la position du prémier caractére qui indique le chemin
var hoteUrl = newUrl.slice(0,posf);
var proto = hoteUrl.split("://"); // On sépare le protocole du reste
hoteUrl = proto[1]; // On récupére le nom de l'hote

// Var option est un objet qui contient les propriétés nécesaires pour obtenir la page html
var options = {
host: hoteUrl,
port: 80,
path: pathUrl
};

// Appel de la fonction get pour avoir en réponse la page html correspondant à l'url: c'est une requete GET en HTTP qui est envoyé
http.get(options, function(res) {
// On recupére le corps de réponse contenant le code html de la page
res.on('data', function (chunk) {
var html = chunk +"";
var pos1= html.indexOf("<title>");
var pos2= html.indexOf("</title>");
var title= html.slice((pos1+7),pos2);
// Si on a trouvé la balise <title> et </title> alors on affiche le titre de la page
if (pos1 !== -1 && pos2 !== -1){
console.log("Titre de la page:" + title);
}
// Si on souhaite sauvegarder le contenus de la page trouvé dans une BDD
if(sauv){
// On crée une instance pour enregistrer la donnée
var content = new html_content();
content.link = newUrl;
content.content = html;
content.save(function (err) {
  if (err) { throw err; }
});
}
});
}).on('error', function(e) {
console.log("Erreur:" +e);
});
});


em.on('search:stat', function(){
// Stat de la recherche : durée et nb de résultat 
var elapsed = new Date().getTime() - start;   
console.log("Nb de résultats: " + nbResu + " en : "+ elapsed +" ms");
});
 

// You should extract all the following "api" related code into its own NodeJS module and require it with
// var api = require('./api');
// api.listen(PORT);
 
app.get('/', function(req, res){
// See: http://expressjs.com/api.html#res.json
res.json(200, {
title:'YOHMC - Your Own Home Made Crawler',
endpoints:[{
url:'http://127.0.0.1:'+PORT+'/queue/size',
details:'the current crawler queue size'
}, {
url:'http://127.0.0.1:'+PORT+'/queue/add?url=http%3A//voila.fr',
details:'immediately start a `get_page` on voila.fr.'
}, {
url:'http://127.0.0.1:'+PORT+'/queue/list',
details:'the current crawler queue list.'
}]
});
});
 
app.get('/queue/size', function(req, res){
res.setHeader('Content-Type', 'text/plain');
res.json(200, {queue:{length:queue.length}});
});
 
app.get('/queue/add', function(req, res){
var url = req.param('url');
get_page(url);
res.json(200, {
queue:{
added:url,
length:queue.length,
}
});
});
 
app.get('/queue/list', function(req, res){
res.json(200, {
queue:{
length:queue.length,
urls:queue
}
});
});
 
app.listen(PORT);
console.log('Web UI Listening on port '+PORT);
 
// #debug Start the crawler with a link
get_page('http://twitter.com/FGRibreau'); //Pour activer les options get_page('http://twitter.com/FGRibreau', boolean infos, boolean images, boolean save);
