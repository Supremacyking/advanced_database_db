const {client}= require ('pg')

const con= new Client({
	host:"localhost",
	user:"postgres",
	port:5432,
	password:""
	database:"demopost"
})


con.connect().then(()=> console.log("connected"))