'use strict';
 
/**
* Web Scraper
*/

/** Améliorations par rapport au modéle de base:
*
*Plus d'infos pour l'url: Le titre de la page et la taille de la page.
*
*Des stats pour les recherches: nombres de résultats trouvés,temps d'execution de la recherche.
*
*Séparation des url des sites et des url qui pointent vers des images: suivant le choix fait on affichera que les url de site web ou que les url des images en lien avec la recherche *effectuée. 
*
*Et enfin on a deux options supplémentaires lors du lancement de la recherche pour indiquer si on cherche des images ou des sites et si on veut voir les infos supplémentaires sur la *recherche ou juste la liste des liens.
*
*ADD: Ajout fait pour le tp.
*MODIFY: Modification fait pour le tp.
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

/* ADD: Variables pour compter le nb de résultats et la durée de la recherche */
var nbResu = 0; /* On n'utilise pas la propriété queue.length à la place car celui-ci accumule l'ensemble des resultats des différentes recherches donc il indiquerait le nb de résultat de toutes les recherches et pas juste celui de la derniere recherche */
var start = new Date().getTime();  
/* ADD : expression réguliére pour trier liens finissant par des noms d'extension d'images */
var EXTRACT_IMG_REG = new RegExp("\.(png|jpg|gif|bmp|ico)$","i");
/* Le deuxiéme paramêtre "i" indique que l'on ient pas compte de la casse */

/**
* Get the page from `page_url`
* @param {String} page_url String page url to get
*
* `get_page` will emit
*/

/* MODIFY: get_page est modifiée de façon à acceuillir deux nouveaux arguments booléen : le premier "infos" permet de dire si on veut voir les détail sur la recherche, le second "img" permet d'indiquer si on cherche uniquement des images */
function get_page(page_url,infos,img){
em.emit('page:scraping', page_url);

/* On indique que l'on débute la recherche à cette heure là (pour le calcul de la durée de la recherche) */
start = new Date().getTime();  
// See: https://github.com/mikeal/request
request({
url:page_url,
}, function(error, http_client_response, html_str){
/**
* The callback argument gets 3 arguments.
* The first is an error when applicable (usually from the http.Client option not the http.ClientRequest object).
* The second is an http.ClientResponse object.
* The third is the response body String or Buffer.
*/

if(error){
em.emit('page:error', page_url, error);
return;
}
/*ADD: Deux cas: si on veut les infos ou non*/
/* Ajout d'un appel vers deux evenements si "infos" est vrai*/
if(infos){
em.emit('search:info',page_url, html_str);
}
/* On rajoute l'argument pour l'evenement qui permet d'indiquer si on affiche que les images*/
em.emit('page', page_url, html_str, img);
if(infos){
em.emit('search:stat',page_url, html_str);
}
});
}
 
/**
* Extract links from the web pagr
* @param {String} html_str String that represents the HTML page
*
* `extract_links` should emit an `link(` event each
*/
/* MODIFY: ajout d'un argument "img" */
function extract_links(page_url, html_str, img){
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match
// "match" can return "null" instead of an array of url
// So here I do "(match() || []) in order to always work on an array (and yes, that's another pattern).
(html_str.match(EXTRACT_URL_REG) || []).forEach(function(url){
// see: http://nodejs.org/api/all.html#all_emitter_emit_event_arg1_arg2


/* Si l'on veut les images et que le lien pointe vers une image alors on le rajoute à la liste*/
if(img && url.match(EXTRACT_IMG_REG)){
em.emit('url', page_url, html_str, url);
/* Si l'on veut pas les images et que le lien n'est pas une image alors on le rajoute à la liste*/
}else if(!img && !url.match(EXTRACT_IMG_REG)){
em.emit('url', page_url, html_str, url);
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
 
em.on('url', function(page_url, html_str, url){
console.log('We got a link! ', url);
/*ADD: Incrementetation du nombre de résultat*/
nbResu++;
});
 
em.on('url', handle_new_url);

/*ADD: Ajout des nouveaux évenements*/

em.on('search:info', function(page_url, html_str){
/* html_str contient tout le code source html de la page */
/* Creation d'une variable pour récuperer le titre de la page */
var pos1= html_str.indexOf("<title>");
var pos2= html_str.indexOf("</title>");
var title= html_str.slice((pos1+7),pos2);
console.log("Titre de la page de l'url indiqué:" + title);
console.log("Nb caractéres:" + html_str.length);
});

em.on('search:stat', function(){
/* Stat de la recherche : durée et nb de resultat */ 
var elapsed = new Date().getTime() - start;   
console.log("Nb de résultats: " + nbResu + " en : "+ elapsed +" ms");
nbResu =0;
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
get_page('http://twitter.com/FGRibreau');
