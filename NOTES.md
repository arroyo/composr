# Notes

## Supported LLM Models
- GPT 5.4 Pro
- GPT 5.4
- GPT 4.1
- GPT 4o
- Claude Opus 4.6
- Claude Sonnet 4.6
- Claude Haiku 4.5

## Music Prompts
Create a hip hop beat in the style of dr dre, 4 measures long

Create a hip hop song in the style of Dr Dre. It should be 14 measures long.

Create an 8-measure chill hip hop beat with a funky bass line and a catchy melody.

Create a bluegrass song in G Major. Song should be 12 measures long. Use the chords F (I), Gm (ii), Am (iii), Bb (IV), C (V), and Dm (vi) for the song.

create a house song 12 measures long. It should have a cool beat and a lead synth melody that uses the chord progression F (I), Gm (ii), Am (iii), Bb (IV), C (V), and Dm (vi).

Create a romantic song for a string quartet. The lead violin should sing and have a pretty melody. Make it 10 measures long.

Create a song for a string quartet. The lead violin should have some quarter and eighth notes. Add all four parts, incorporating a pretty melody. Make it 10 measures long.

Create a country song that is 10 measures long. Feature a harmonica for the lead. It acts as a stand in for vocals.

Create a bluegrass song in G Major. Song should be 12 measures long and have 3 movements.
The banjo should be playing a steady rhythm and the fiddle should be playing a melody. The bass should be playing a steady rhythm and the guitar should be playing a steady rhythm.

create a 30 second up beat rock and roll song in F Major.
I want a steady, driving rhythm with hi-hats playing eighth notes, a strong backbeat on the snare drum (beats 2 and 4), and a foundational kick drum (beats 1 and 3).

create an 8 measure up beat rock and roll song in F Major. The beat is steady, with a fill every fourth measure. Have main guitar, rhythm guitar, electric bass, and drums. 

create a 12 measure up beat rock and roll song in F Major. The beat is a steady, driving rhythm with hi-hats playing eighth notes, a strong backbeat on the snare drum (beats 2 and 4), and a foundational kick drum (beats 1 and 3). The electric guitars wail and and electric bass keeps with the time

## Features
Allow the user to change the tempo using the ui. Simple up/down arrows will suffice

Let's improve the change instrument feature. Make it two levels. First one is the plugin, second is the instrument. Also look through the libraries and make sure we have all of the synths cataloged in the json file.

When you adjust the sliders in mixer view it...

Add an export button in between load and clear. The export feature should save the song as a standards compliant midi file. 

Add midi support to each track. When in mixer view give users the option to send the notes via midi instead of playing using a build in instrument. Midi channel should be user selectable.


Let's figure out how to improve the agent's music composing skills. Below are some issues with the current agent. How can we address these shortcomings?

When it creates a song, it is often only 1-2 measures long. Occasionally it will be a little longer if I explicitly ask for something longer but it never follows the number of measures or time specified. How can we make the songs longer and add some basic control over length?

Rhythms are usually boring and do not represent the genre mentioned.

Often the melodies do not resemble the genre mentioned nor include enough note variation. For melodies, using only quarter notes for too long can sound boring.

