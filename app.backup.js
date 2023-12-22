const { App, Homey } = require('homey');
const axios = require('axios'); // Required for fetching images


class Birthdays extends App {
    async onInit() {
        this.log('Birthdays has been initialized');
        this.birthdays = [];
        await this.initializeBirthdays();

        this.registerTriggerCard();
        this.registerActionCard();

        // Check birthdays upon initialization
        this.checkForTodaysBirthdays();

        // Set up a daily interval to check for birthdays
        setInterval(this.checkForTodaysBirthdays.bind(this), 1 * 60 * 60 * 1000);

//    this.tokens = {
//        name: await this.homey.flow.createToken('name', {
//            type: 'string',
//            title: 'Name'
//        }),
//
//        mobile: await this.homey.flow.createToken('mobile', {
//            type: 'string',
//            title: 'Mobile'
//        }),
//        message: await this.homey.flow.createToken('message', {
//            type: 'string',
//            title: 'Message'
//        }),
//        age: await this.homey.flow.createToken('age', {
//            type: 'number',
//            title: 'Age'
//        })
//   };
//   await this.tokens.age.setValue(35);
}
    async fetchBirthdays() {
        try {
            const storedBirthdays = await this.homey.settings.get('birthdays');
            if (storedBirthdays) {
                this.birthdays = storedBirthdays;
                this.logCompleteBirthdayList();
            }
        } catch (error) {
            this.log('Error fetching birthdays:', error);
        }
    }

    async initializeBirthdays() {
        await this.fetchBirthdays();
    
        this.homey.settings.on('set', async (key) => {
            if (key === 'birthdays') {
                await this.fetchBirthdays();
                this.notifyBirthdayAdded(this.birthdays[this.birthdays.length - 1]);
            }
        });
    }
    

    async logCompleteBirthdayList() {
        if (!this.birthdays || !Array.isArray(this.birthdays) || !this.birthdays.length) {
            this.log('No birthdays available or invalid format.');
            return;
        }
    
        this.birthdays.forEach(birthday => {
            const age = birthday.year ? new Date().getFullYear() - parseInt(birthday.year) : 0;

            this.log(`Birthday in list = Name: ${birthday.name} - Birthday: ${birthday.date.substring(5)} - BirthYear: ${birthday.year} - Age: ${age} - Message: ${birthday.message}`);
        });
    }
    
    isValidTriggerData(data) {
        return (
            typeof data.name === 'string' &&
            typeof data.mobile === 'string' &&
            typeof data.message === 'string' &&
            typeof data.age === 'number'
        );
    }

    async checkForTodaysBirthdays() {
        const today = new Date();
        const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const lastTriggeredDate = await this.homey.settings.get('lastTriggeredDate');
    
        // Als we al hebben getriggerd voor vandaag, controleer dan niet opnieuw
        if (lastTriggeredDate === formattedToday) {
            this.log('Already triggered the birthday card for today.');
            return;
        }
        
        const birthdayPerson = this.birthdays.find(p => p.date.substring(5) === formattedToday.substring(5)); // Vergelijk alleen MM-DD
        
        // Na het vinden van birthdayPerson:
        if (!birthdayPerson.name || typeof birthdayPerson.name !== 'string') {
            this.log('Error: Invalid or missing name for birthday person.', birthdayPerson);
            return;
        }
            
        const age = birthdayPerson.year ? today.getFullYear() - parseInt(birthdayPerson.year) : null;
    
        if (birthdayPerson && birthdayPerson.name && birthdayPerson.mobile && birthdayPerson.message) {
            const triggerData = { 
                name: birthdayPerson.name, 
                age: age || 0,
                mobile: birthdayPerson.mobile,  
                message: birthdayPerson.message 
            };

            await this.tokens.mobile.setValue(triggerData.mobile);
            await this.tokens.message.setValue(triggerData.message);
            await this.tokens.age.setValue(triggerData.age);  
        
    
            // Controleer op ongedefinieerde waarden in triggerData
            Object.entries(triggerData).forEach(([key, value]) => {
                if (typeof value === 'undefined') {
                    this.log(`Error: Undefined value detected for key ${key} in triggerData.`);
                }
            });
            
            if (this.isValidTriggerData(triggerData)) {
                this.log('TriggerData before triggering:', triggerData);  // Hier is de logregel
                this.homey.flow.getTriggerCard('birthday-today').trigger(triggerData).then(() => {
                    // Hier wordt de laatst geactiveerde datum bijgewerkt nadat de kaart is geactiveerd
                    this.homey.settings.set('lastTriggeredDate', formattedToday);
                }).catch(error => {
                    this.log('Error triggering the card:', error);
                });
            } else {
                this.log('Error: Invalid trigger data:', triggerData);
            }            
        } else {
            this.log('Missing birthday data or today is not a birthday.');
        }
    }
    
    
    async sendNotifications(birthdayPerson, age) {
        const translations = {
                "en": `Today is the birthday of **${birthdayPerson.name}** 🎉. He/she turned **${age}** years old.`,
                "nl": `Vandaag is de verjaardag van **${birthdayPerson.name}** 🎉. Hij/zij is **${age}** jaar oud.`,
                "de": `Heute ist der Geburtstag von **${birthdayPerson.name}** 🎉. Er/sie ist **${age}** Jahre alt.`,
                "fr": `Aujourd'hui, c'est l'anniversaire de **${birthdayPerson.name}** 🎉. Il/elle a **${age}** ans.`,
                "it": `Oggi è il compleanno di **${birthdayPerson.name}** 🎉. Lui/lei ha compiuto **${age}** anni.`,
                "es": `Hoy es el cumpleaños de **${birthdayPerson.name}** 🎉. Él/ella cumplió **${age}** años.`,
                "sv": `Idag är det **${birthdayPerson.name}**'s födelsedag 🎉. Han/hon fyller **${age}** år.`,
                "no": `I dag er det **${birthdayPerson.name}** sin bursdag 🎉. Han/hun er **${age}** år gammel.`,
                "da": `I dag er det **${birthdayPerson.name}**'s fødselsdag 🎉. Han/hun er **${age}** år gammel.`,
                "ru": `Сегодня день рождения **${birthdayPerson.name}** 🎉. Ему/ей исполнилось **${age}** лет.`,
                "pl": `Dziś są urodziny **${birthdayPerson.name}** 🎉. On/ona ma **${age}** lat.`     
            };
        
            const language = this.homey.i18n.getLanguage();
            const notificationMessage = translations[language] || translations['en'];
    
            try {
                await this.homey.notifications.createNotification({ excerpt: notificationMessage });
            } catch (error) {
                this.log('sendNotifications - error', error);
            }
        }
    
        async notifyBirthdayAdded(birthdayPerson) {
            const translations = {
                "en": `Birthday of **${birthdayPerson.name}** added to the list.`,
                "nl": `Verjaardag van **${birthdayPerson.name}** toegevoegd aan de lijst.`,
                "de": `Geburtstag von **${birthdayPerson.name}** zur Liste hinzugefügt.`,
                "fr": `Anniversaire de **${birthdayPerson.name}** ajouté à la liste.`,
                "it": `Compleanno di **${birthdayPerson.name}** aggiunto alla lista.`,
                "es": `Cumpleaños de **${birthdayPerson.name}** añadido a la lista.`,
                "sv": `Födelsedagen för **${birthdayPerson.name}** har lagts till i listan.`,
                "no": `Bursdagen til **${birthdayPerson.name}** er lagt til i listen.`,
                "da": `Fødselsdagen for **${birthdayPerson.name}** er tilføjet til listen.`,
                "ru": `День рождения **${birthdayPerson.name}** добавлен в список.`,
                "pl": `Urodziny **${birthdayPerson.name}** zostały dodane do listy.`                
            };

            const language = this.homey.i18n.getLanguage();
            const notificationMessage = translations[language] || translations['en'];
    
            try {
                await this.homey.notifications.createNotification({ excerpt: notificationMessage });
            } catch (error) {
                this.log('notifyBirthdayAdded - error', error);
            }
        }
    

        registerTriggerCard() {
            const birthdayTriggerCard = this.homey.flow.getTriggerCard('birthday-today');
        
            birthdayTriggerCard.registerRunListener(async (args, state) => {
                if (this.isValidTriggerData(state)) {
                    return true;
                } else {
                    this.log('Error: Invalid trigger state:', state);
                    return false;
                }
            });
             
            this.homey.flow.getConditionCard('is-birthday-today').registerRunListener(async (args, state) => {
                const today = new Date();
                const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const birthdayPerson = this.birthdays.find(p => p.date.substring(5) === formattedToday.substring(5));
                return !!birthdayPerson;
            });
    
            this.homey.flow.getActionCard('temporary-image').registerRunListener(async (args, state) => {
                this._image = args.image;
                this._imageSet = true;
                setTimeout(() => {
                    this._imageSet = false;
                }, 120000);
                return true;
            });
        }
            registerActionCard() {
                const getNextBirthdayActionCard = this.homey.flow.getActionCard('get-next-birthday');
            
                getNextBirthdayActionCard.registerRunListener(async (args, state) => {
                    const nextBirthdayPerson = this.getNextBirthdayPerson();
            
                    if (nextBirthdayPerson) {
                        const today = new Date();
                        const age = nextBirthdayPerson.year ? today.getFullYear() - parseInt(nextBirthdayPerson.year) : null;
            
                        const tokens = {
                            name: nextBirthdayPerson.name,
                            mobile: nextBirthdayPerson.mobile,
                            message: nextBirthdayPerson.message,
                            date: nextBirthdayPerson.date,
                            age: age || "0"
                        };
            
                        return tokens;  // returning the tokens will pass them to the card
                    } else {
                        throw new Error('No upcoming birthdays found.');
                    }
                });
            
            }
            getNextBirthdayPerson() {
                const today = new Date();
                const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                
                // Sort the birthdays in ascending order of date starting from today
                const sortedBirthdays = [...this.birthdays].sort((a, b) => {
                    const aDate = new Date(a.date);
                    const bDate = new Date(b.date);
                    return aDate - bDate;
                });
            
                for (let birthdayPerson of sortedBirthdays) {
                    const bDate = new Date(birthdayPerson.date);
                    if (bDate > today) {
                        return birthdayPerson;
                    }
                }
                
                return null;
            }
            
            
        }
    
    
    module.exports = Birthdays;
