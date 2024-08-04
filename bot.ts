import { Bot, InputFile } from "grammy"

import * as dotenv from 'dotenv'
dotenv.config()

// @ts-ignore: Deno package exists, compiler is stupid
import { Database } from "https://deno.land/x/sqlite3@0.11.1/mod.ts";

interface BanknoteResult {
    id: number,
    title: string,
    url: string,
    img: string,
    actual_price: string,
    branch: {
        city: string,
    }
}

class Banknote {
    private apiPath: string;

    constructor(){
        this.apiPath = "https://veikals.banknote.lv/lv/filter-products?title="
    }

    async getData(query: string) : Promise<BanknoteResult[]> {
        const response = await fetch(this.apiPath + query)
        const json = await response.json()

        const parsed_data = this.serializeData(json)

        return parsed_data
    }

    private serializeData(json_data: any) : BanknoteResult[] {
        const data_array = json_data.data

        const results: BanknoteResult[] = data_array.map((e) => 
            ({
                id: e.id,
                title: e.title,
                url: e.url,
                img: this.parseImageURL(e.img),
                actual_price: e.actual_price,
                branch: {
                    city: e.branche.city
                }
            })
        )

        return results
    }

    private parseImageURL(s: string) : string {
        const uri = 'https://veikals.banknote.lv' + s

        return encodeURI(uri)
    }
}

class JobHandler {
    private db: Database;

    constructor(db: Database) {
        this.db = db
    }

    public queryDataFromDb(){
        const result = this.db.prepare('select * from queries')
        
        for (const row of result.all()) {
            console.log(row);
        }
    }
}

const db: Database = new Database("./db/queries.db");
const api = new Banknote()
const jobs = new JobHandler(db)

//db.exec('create table queries (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id varchar(255), query varchar(255) not null)')
//db.exec('INSERT INTO queries (user_id, query) VALUES (1, \'test\')')

const token = process.env.TELEGRAM_TOKEN 

if (!token) {
    throw new Error("No telegram token in .env!");
}

const bot = new Bot(token)

bot.command("help", async (ctx) => {
    ctx.reply(
        "Sveiks, es esmu BanknoteScraper!\nŠeit ir padziļināts paskaidrojums manām komandām:\n\n<b>/sekot</b> - Pieseko noteiktam atslēgas vārdam, kad banknote parādīsies noteikta prece, tad atsūtīšu tev ziņu ar viņu!",
        { parse_mode: "HTML" },
    )
})

bot.command("sekot", async (ctx) => {
    const query = ctx.match

    if (!query || query == ""){
        ctx.reply('Lieto komandu ar "/sekot lieta-kurai-sekot"')
        return
    }

    const data = await api.getData(ctx.match)
    const bilde = new InputFile(new URL(data[0].img))

    // Try to send the picture first, if everything ok, send the description    
    try {
        ctx.replyWithPhoto(bilde)
    } catch (e) {
        console.log("Problēma ar bildi: ", data[0].img)
    } finally {
        ctx.reply(`${data[0].title} | ${data[0].actual_price}$`)
    }
})

await bot.api.setMyCommands([
    { command: "sekot", description: "Pieseko noteiktam atslēgas vārdam" },
    { command: "help", description: "Palīgā!" },
  ]);

jobs.queryDataFromDb()

bot.start()
console.log("BanknoteScraper bot is running!")