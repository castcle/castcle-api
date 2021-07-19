export class CreateAccountDto{
    isGuess:boolean;
    updateDate:Date;
    createDate:Date;
    preferences:{
        langagues:string[]
    }
}