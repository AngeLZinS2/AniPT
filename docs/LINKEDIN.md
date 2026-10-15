# AniBR — apresentação para LinkedIn

Desenvolvi o AniBR como um projeto de portfólio com duas formas de uso: aplicativo desktop e interface interativa no terminal.

O projeto começou como AniPT, em Go. A CLI continua disponível, agora também chamada AniBR, com pesquisa, favoritos, histórico e reprodução por mpv/VLC. Para o desktop, construí uma interface em TypeScript com núcleo em Rust e Tauri 2, reunindo descoberta de animes, biblioteca pessoal e retomada de episódios em português.

No desktop, integrei o catálogo do AniList, persistência com SQLite, fontes compatíveis e um player com suporte a HLS e torrents pelo librqbit. Também trabalhei na identificação de temporadas, no backup e nas preferências locais.

Na parte visual, criei uma apresentação com lettering SVG animado e um mosaico revelado por faixas que acompanham o mouse, respeitando a preferência por movimento reduzido. Preparei ainda um site responsivo, um vídeo de apresentação e versões instalável e portátil.

Foi uma oportunidade de aprender conectando interface, integração com serviços externos, processamento nativo e testes automatizados.

Convido você a conhecer o projeto e compartilhar feedback sobre a implementação!

Apresentação e downloads: http://173.212.251.120:8085/

GitHub: https://github.com/AngeLZinS2/AniPT

#Rust #TypeScript #Portfolio
