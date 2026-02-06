# Catálogo PDF para "Mensagem inicial (catálogo)"

Para usar o **catálogo do repositório** no Render (ou em qualquer deploy), coloque aqui um PDF com o nome:

**`catalogo-padrao.pdf`**

Ou seja, o caminho final deve ser: `catalogs/catalogo-padrao.pdf`

## Como fazer

1. Coloque seu PDF de catálogo nesta pasta com o nome **catalogo-padrao.pdf**.
2. Faça commit e push para o GitHub.
3. No deploy (ex.: Render), na interface da aplicação, no card "Mensagem inicial (catálogo)", escolha **"Usar catálogo do repositório (catalogo-padrao.pdf no GitHub)"**.
4. Assim o servidor usa o arquivo que está no repositório — não é preciso anexar da sua máquina e o fluxo funciona 100% na nuvem.

O arquivo `current.pdf` (gerado quando alguém envia um PDF pelo formulário) não é commitado; apenas `catalogo-padrao.pdf` pode ficar no repositório.
