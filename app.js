"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const homey_1 = __importDefault(require("homey"));
const crypto = __importStar(require("crypto"));
const axios = require("axios");
class Birthdays extends homey_1.default.App {
    get image() {
        return this._image;
    }
    set image(value) {
        this._image = value;
    }
    // private birthdays?: Birthday[];
    persons;
    tokens;
    birthdayTriggerCard;
    specificBirthdayTriggerCard;
    categoryBirthdayTriggerCard;
    isBirthdayTodayConditionCard;
    isSpecificBirthdayTodayConditionCard;
    _image;
    debug = false;
    async onInit() {
        this.log("Birthdays has been initialized");
        this.sendNotifications();
    }
    async sendNotifications() {
        try {
            const ntfy2023111801 = `[Birthdays 🎉] (1/2) - When you have problems sending out birthday reminders etc...`;
            const ntfy2023111802 = `[Birthdays 🎉] (2/2) - Then make sure no settings field contains the word "Undefined". Delete the word and save again.`;
            await this.homey.notifications.createNotification({
                excerpt: ntfy2023111802
            });
            await this.homey.notifications.createNotification({
                excerpt: ntfy2023111801
            });
        }
        catch (error) {
            this.log('sendNotifications - error', console.error());
        }
        await this.initializeBirthdays();
        this.registerTriggerCard();
        // Check birthdays upon initialization
        await this.checkBirthdayTriggers();
        // Checks triggers every minute
        this.homey.setInterval(this.checkBirthdayTriggers.bind(this), 60 * 1000);
        // Maak globale tokens aan
        this.tokens = {
            name: await this.homey.flow.createToken("name", {
                type: "string",
                title: "Name",
                value: "Default Name"
            }),
            mobile: await this.homey.flow.createToken("mobile", {
                type: "string",
                title: "Mobile",
                value: "Default Mobile"
            }),
            mobile2: await this.homey.flow.createToken("mobile2", {
                type: "string",
                title: "Mobile2",
                value: "Empty field"
            }),
            message: await this.homey.flow.createToken("message", {
                type: "string",
                title: "Message",
                value: "Happy Birthday!"
            }),
            age: await this.homey.flow.createToken("age", {
                type: "number",
                title: "Age",
                value: 0
            }),
            imageUrl: await this.homey.flow.createToken("imageUrl", {
                type: "string",
                title: "URL Image",
                value: "Https://"
            }),
            category: await this.homey.flow.createToken("category", {
                type: "string",
                title: "Category",
                value: "Work"
            })
        };
    }
    async migrateBirthdaysToPersonsSetting() {
        if (this.homey.settings.get("persons") !== null) {
            this.log("Birthdays have been migrated to persons");
            return;
        }
        try {
            let birthdays = await this.homey.settings.get("birthdays");
            const mappedBirthdays = birthdays.map((birthday) => {
                return {
                    id: this.getUniqueId(birthday),
                    name: birthday.name,
                    dateOfBirth: birthday.date || birthday.dateOfBirth,
                    year: birthday.year,
                    mobile: birthday.mobile,
                    mobile2: birthday.mobile2,
                    message: birthday.message,
                    imageUrl: birthday.imageUrl,
                    category: birthday.category
                };
            });
            if (this.debug) {
                this.log("birthdays to migrate:", birthdays);
                this.log("mapped birthdays:", mappedBirthdays);
            }
            this.homey.settings.set("persons", mappedBirthdays);
        }
        catch (error) {
            this.log("Error fetching birthdays:", error);
        }
    }
    async fetchBirthdays() {
        try {
            this.persons = await this.homey.settings.get("persons");
            await this.logCompleteBirthdayList();
        }
        catch (error) {
            this.log("Error fetching birthdays:", error);
        }
    }
    async initializeBirthdays() {
        await this.migrateBirthdaysToPersonsSetting();
        await this.fetchBirthdays();
        this.homey.settings.on("set", async (...args) => {
            if (args[0] === "persons") {
                await this.fetchBirthdays();
            }
        });
    }
    async logCompleteBirthdayList() {
        this.persons?.forEach((person) => {
            const age = this.getPersonAge(person); // Gebruik de bestaande functie om de leeftijd te berekenen
            this.log(`Person in list = Name: ${person.name} - Date of birth: ${person.dateOfBirth} - Mobile ${person.mobile} - Mobile 2 ${person.mobile} - Age: ${age} - Message: ${person.message}`);
        });
    }
    isValidTriggerData(data) {
        return (typeof data.name === "string" &&
            typeof data.mobile === "string" &&
            typeof data.mobile2 === "string" &&
            typeof data.message === "string" &&
            typeof data.age === "number" &&
            typeof data.imageUrl === "string" &&
            typeof data.category === "string");
    }
    getPersonsWithBirthdaysToday() {
        return this.persons?.filter((person) => {
            const today = new Date();
            const formattedToday = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            return person.dateOfBirth && person.dateOfBirth.substring(5) === formattedToday;
        }) ?? [];
    }
    ;
    getAvailableCategories() {
        const categories = new Set();
        this.persons?.forEach((person) => {
            if (person.category && person.category.trim() !== "") {
                categories.add(person.category.trim());
            }
        });
        return Array.from(categories);
    }
    ;
    async checkBirthdayTriggers() {
        this.log("Checking birthdays");
        if (this.debug) {
            this.log("Persons with birthdays today", this.getPersonsWithBirthdaysToday());
        }
        const birthdaysToday = this.getPersonsWithBirthdaysToday();
        for (let i = 0; i < birthdaysToday.length; i++) {
            const birthdayPerson = birthdaysToday[i];
            const tokens = {
                name: birthdayPerson.name,
                age: this.getPersonAge(birthdayPerson),
                mobile: birthdayPerson.mobile,
                mobile2: birthdayPerson.mobile2,
                message: birthdayPerson.message,
                imageUrl: birthdayPerson.imageUrl,
                category: birthdayPerson.category
            };
            const state = {
                person: birthdayPerson
            };
            if (this.debug) {
                this.log("trigger birthday triggers with", { tokens, state });
            }
            this.birthdayTriggerCard?.trigger(tokens, state);
            this.specificBirthdayTriggerCard?.trigger(tokens, state);
            this.categoryBirthdayTriggerCard?.trigger(tokens, state);
            // Update globale tokens
            this.updateGlobalTokens(birthdayPerson);
            // Wacht voor een specifieke tijd voordat je doorgaat naar de volgende jarige persoon
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconden wachten
        }
    }
    // Methode om globale tokens bij te werken
    async updateGlobalTokens(birthdayPerson) {
        try {
            if (this.tokens && this.tokens.name) {
                await this.tokens.name.setValue(birthdayPerson.name);
            }
            if (this.tokens && this.tokens.mobile) {
                await this.tokens.mobile.setValue(birthdayPerson.mobile || "No mobile");
            }
            if (this.tokens && this.tokens.mobile2) {
                await this.tokens.mobile2.setValue(birthdayPerson.mobile2 || "No mobile");
            }
            if (this.tokens && this.tokens.message) {
                await this.tokens.message.setValue(birthdayPerson.message || "Happy Birthday!");
            }
            if (this.tokens && this.tokens.imageUrl) {
                await this.tokens.imageUrl.setValue(birthdayPerson.imageUrl || "Https://");
            }
            if (this.tokens && this.tokens.category) {
                await this.tokens.category.setValue(birthdayPerson.category || "Work");
            }
            if (this.tokens && this.tokens.age) {
                const age = this.getPersonAge(birthdayPerson);
                await this.tokens.age.setValue(Number(age));
            }
        }
        catch (error) {
            this.log("Error updating global tokens", error);
        }
    }
    registerTriggerCard() {
        // Birthday trigger card
        this.birthdayTriggerCard = this.homey.flow.getTriggerCard("birthday-today");
        this.birthdayTriggerCard.registerRunListener(async (args, state) => {
            // Validate that the current time matches the args.run_at time which has the format "HH:mm"
            return this.verifyRunAtByArgs(args);
        });
        // Specific person birthday trigger card
        this.specificBirthdayTriggerCard = this.homey.flow.getTriggerCard("specific-birthday-today");
        this.specificBirthdayTriggerCard.registerRunListener(async (args, state) => {
            // Validate that the current time matches the args.run_at time which has the format "HH:mm" and verify that the person is the same
            return this.isSamePerson(args.person, state.person) && this.verifyRunAtByArgs(args);
        });
        this.specificBirthdayTriggerCard.registerArgumentAutocompleteListener("person", this.autocompletePersons.bind(this));
        // Category birthday trigger card
        this.categoryBirthdayTriggerCard = this.homey.flow.getTriggerCard("category-birthday-today");
        this.categoryBirthdayTriggerCard.registerRunListener(async (args, state) => {
            // Validate that the current time matches the args.run_at time which has the format "HH:mm" and verify that the person belongs to the provided category
            return String(args.category.id).toLowerCase() === String(state.person.category).toLowerCase()
                && this.verifyRunAtByArgs(args);
        });
        this.categoryBirthdayTriggerCard.registerArgumentAutocompleteListener("category", this.autocompleteCategories.bind(this));
        // Is birthday condition card
        this.isBirthdayTodayConditionCard = this.homey.flow.getConditionCard("is-birthday-today");
        this.isBirthdayTodayConditionCard.registerRunListener(async (args, state) => {
            return this.getPersonsWithBirthdaysToday().length > 0;
        });
        // Is specific person birthday condition card
        this.isSpecificBirthdayTodayConditionCard = this.homey.flow.getConditionCard("is-specific-birthday-today");
        this.isSpecificBirthdayTodayConditionCard.registerRunListener(async (args) => {
            const person = this.findPersonById(args.person.id);
            return this.isPersonsBirthday(person);
        });
        this.isSpecificBirthdayTodayConditionCard.registerArgumentAutocompleteListener("person", this.autocompletePersons.bind(this));
        this.homey.flow.getActionCard("temporary-image").registerRunListener(this.temporaryImageRunListener.bind(this));
    }
    async temporaryImageRunListener(args) {
        const { imageUrl } = args;
        try {
            this._image = await this.homey.images.createImage();
            await this._image.setStream(async (stream) => {
                const response = await axios.get(imageUrl, { responseType: "stream" });
                if (response.status !== 200) {
                    this.error("Error fetching image:", response.statusText);
                    throw new Error("Error fetching image");
                }
                response.data.pipe(stream);
            });
            const tokens = {
                image: this._image
            };
            return tokens;
        }
        catch (error) {
            this.error("Error setting image:", error);
            throw new Error("Error setting image");
        }
    }
    async autocompletePersons(query, args) {
        // Return all persons mapped to homey flow card autocomplete items and optionally filtered by the query
        return this.persons
            ?.map((person) => {
            return {
                id: person.id,
                name: person.name
            };
        })
            .filter((result) => {
            return result.name.toLowerCase().includes(query.toLowerCase());
        });
    }
    async autocompleteCategories(query) {
        // Return all categories mapped to homey flow card autocomplete items and optionally filtered by the query
        return this.getAvailableCategories()
            .map((category) => {
            return {
                id: category,
                name: category
            };
        })
            .filter((result) => {
            return result.name.toLowerCase().includes(query.toLowerCase());
        });
    }
    verifyRunAtByArgs(args) {
        const now = new Date();
        const targetTimezone = this.homey.clock.getTimezone();
        const nowString = now.toLocaleTimeString(this.getLocale(), { timeZone: targetTimezone, hour12: false });
        const [nowHours, nowMinutes] = nowString.split(":").map(Number);
        const [runAtHours, runAtMinutes] = args.run_at.split(":").map(Number);
        if (this.debug) {
            this.log("verify run at", {
                nowHours,
                nowMinutes,
                runAtHours,
                runAtMinutes
            });
        }
        return nowHours === runAtHours &&
            nowMinutes === runAtMinutes;
    }
    convertTimeToCron(time) {
        const [hours, minutes] = time.split(":");
        // Validate hours and minutes
        if (parseInt(hours) < 0 || parseInt(hours) > 23 || parseInt(minutes) < 0 || parseInt(minutes) > 59) {
            throw new Error("Invalid time format. Hours must be between 0 and 23, and minutes must be between 0 and 59.");
        }
        return `${minutes} ${hours} * * *`; // Cron format: "minutes hours * * *"
    }
    //  private registerActionCard() {
    //    const getNextBirthdayActionCard = this.homey.flow.getActionCard("get-next-birthday");
    //
    //    getNextBirthdayActionCard.registerRunListener(async (args, state) => {
    //      const nextBirthdayPerson = this.getNextBirthdayPerson();
    //
    //      if (nextBirthdayPerson) {
    //        const today = new Date();
    //        const age = nextBirthdayPerson.year ? today.getFullYear() - parseInt(nextBirthdayPerson.year) : null;
    //
    //        const tokens = {
    //          name: nextBirthdayPerson.name,
    //          mobile: nextBirthdayPerson.mobile,
    //          message: nextBirthdayPerson.message,
    //          date: nextBirthdayPerson.dateOfBirth,
    //          age: age || "0"
    //        };
    //
    //        return tokens;  // returning the tokens will pass them to the card
    //      } else {
    //        throw new Error("No upcoming birthdays found.");
    //      }
    //    });
    //  }
    findPersonById(id) {
        return this.persons?.find((person) => person.id === id);
    }
    isPersonsBirthday(person) {
        return this.getPersonsWithBirthdaysToday().some((birthdayPerson) => this.isSamePerson(birthdayPerson, person));
    }
    getNextBirthdayPerson() {
        const today = new Date();
        const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        // Sort the birthdays in ascending order of date starting from today
        return this.persons
            ?.sort((personA, personB) => {
            const aDate = new Date(personA.dateOfBirth);
            const bDate = new Date(personB.dateOfBirth);
            return aDate.getUTCSeconds() - bDate.getUTCSeconds();
        })
            ?.find(person => {
            const date = new Date(person.dateOfBirth);
            return date.getUTCSeconds() > today.getUTCSeconds();
        });
    }
    getUniqueId(object) {
        const hash = crypto.createHash("sha1");
        hash.update(JSON.stringify(object));
        return hash.digest("hex");
    }
    getPersonAge(person) {
        const today = new Date();
        const birthDate = new Date(person.dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const month = today.getMonth() - birthDate.getMonth();
        if (month < 0 || (month === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }
    getLocale() {
        const localeMappings = {
            en: "en-GB",
            nl: "nl-NL",
            de: "de-DE",
            fr: "fr-FR",
            it: "it-IT",
            es: "es-ES",
            sv: "sv-SE",
            no: "nb-NO",
            da: "da-DK",
            ru: "ru-RU",
            pl: "pl-PL" // Polish (Poland)
        };
        return localeMappings[this.homey.i18n.getLanguage()] || "en-GB"; // Default to English (United Kingdom) if no mapping is found
    }
    isSamePerson(personA, personB) {
        return personA !== undefined && personB !== undefined && personA?.id === personB?.id;
    }
}
module.exports = Birthdays;
//# sourceMappingURL=app.js.map