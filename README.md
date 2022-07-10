# diasend2nightscout-bridge

What (was) the plan here?</br>
Copied the code of dexcom2nightscout bridge change it / enhance it to receive data from diasend.
</br></br>
Why?</br>
Because CamAPS FX (https://camdiab.com/) has only the ability to send data to diasend but I would like to use Nightscout.
</br></br>
So why not getting it done?</br>
Because CamAPS FX and Diasend announced that the service will bei migrated to glooko.
Glooko has an official API, which diasend has not.
So I thought it is better to invest time into glooko.
But.... as always... the migration to glooko took way longer then I thought.
So in the meantime everything could have been up and running.
</br></br>
Is there an alternative?</br>
yes and no, xDrip+ version (from nightly 20220602) supports uploading data from CamAPS FX to Nightscout but it uses Android Pop Messages as Data Source (it does not get data directly from CamAPS FX), so there is no backfill of missing data.
It helps but is far away from perfect and there will be no way to get all information like basal, bolus, carbs, etc. with this method.
</br></br>
Have you been able to get data from diasend?
</br>
Yes, manually it is possible to retrieve all data from diasend (f.e. using Insomnia using OAuth2 and the client secret from diasend android app).
But I do not have the programming skills to put it in an automatic script.
</br></br>
If anyone here with JS experience likes to help - get in touch. 
I can provide all needed data to querry data manually.
I should not take more then 5-10 hours to get a script version up and running for a skilled deverloper.
