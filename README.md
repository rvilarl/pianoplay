# Piano Play

This WebApp helps to learn reading scores. If your keyboard / instrument has a MIDI port, the WebApp will follow your progress on the Score and provide feedback. 

Open your score and have fun!

You are welcomed to use the software at

https://michaelecke.com/pianoplay/

and start providing feedback opening issues in GitHub.

![image](https://user-images.githubusercontent.com/22865285/147494912-154ee69c-7abe-4d38-86d9-a2e110ddf67a.png)

# How to build locally for testing

```
npm install
ionic serve
```

visit http://localhost:8100/pianoplay

# How to build for production

```
npm install
ionic build prod
```

copy the files generated in ./www in your webserver under ./pianoplay

visit https://your-webserver/pianoplay
