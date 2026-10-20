Everybody is sharing videos made with Claude Opus 5.5

Some are excellent

Most look like the same demo

Large text in the center

A gradient behind it

Everything fades in

The logo appears at the end

The difference is not a secret prompt

It is the system around the model

Anthropic released Opus 5.5 on September 22

Its coding and visual judgment make this workflow practical, but the model is only one part of it

 

The model writes the program

The program draws the frames

The renderer turns those frames into a film

The review loop decides whether anyone should see it

A prompt can produce a clip. A studio can produce the next clip without rebuilding itself

This is how I would engineer that studio

I publish practical breakdowns of AI agents, workflows, and production systems on Substack Join the newsletter here

 

# What Opus is actually making

You ask for a video

Opus does not need to imagine every frame as a separate image

It can write code that answers a more useful question

 

That code becomes a frame function

 

A renderer calls it across the timeline, captures frames, and encodes them into a video file

This changes the economics of revision

If a title enters too early, you change one time value

If a shape overshoots too far, you change one motion curve

If a product screen is wrong, you replace the asset and render again

You do not ask a video model to regenerate the whole shot and hope it remembers the previous version

Code-made motion is not the answer to every visual problem. Photoreal scenes, complex characters, and organic movement may still need footage or generated video

But for product films, UI motion, data stories, typography, diagrams, and launch explainers, a controllable frame function is a serious advantage

 

# The studio has five layers

Most people give Opus a description and judge the MP4

That skips almost every layer that determines the result

 

 

The model can help with all five

It should not be allowed to collapse them into one uninspected step

That is where the generic output comes from

The model fills missing decisions with the safest visual defaults it knows

Your job is to remove the missing decisions before it starts rendering

 

# 1. Write a director's brief, not a vibe prompt

"Make an insane product video" leaves the important choices undefined

Thariq from the Claude Code team put the "one-shot" myth in perspective

 

What is the product?

What is the one thing the viewer should remember?

Which visual reference is allowed to influence the work?

Which elements must come from the real product?

What would make the result unacceptable?

Give Opus a small production document before giving it a render task

 

Notice what this does

It separates facts about the product from choices about the film

The model can invent camera movement

It cannot invent your dashboard

It can propose a stronger opening

It cannot quietly replace your logo

That boundary matters more than a longer adjective list

 

# 2. Give it a reference it can inspect

If you do not supply a visual grammar, the model supplies its own

That is why unrelated one-prompt reels often look related

Give it a frame, a short film, or a folder of previous work

Then make it write down what it learned

 

The output should be a style guide, not a collage of borrowed shots

For a product film, also give Opus access to the real site and ask it to collect the exact screens it intends to animate

Review that asset list before production

If an asset is missing, the agent should stop and ask rather than draw a convincing fake

 

# 3. Turn the story into states and beats

A list of effects is not a storyboard

"Zoom in, then morph, then add particles" describes activity, not meaning

A stronger plan says what the viewer knows at each moment

 

Each beat needs an entry state, an exit state, and a reason to exist

For UI motion, write a state list before drawing transitions

 

Now the model can design continuity between known states

One component may change size, color, content, and position across the film while remaining recognizably the same object

That is a better brief than "make the interface dynamic"

 

The shot list is also a contract

If the agent cannot explain why shot four exists, shot four does not belong in the render

 

# 4. Choose the renderer on purpose

Opus can write a lightweight Canvas or SVG film in one project

That is useful for a small, self-contained piece

For a repeatable series, a video framework can make scene structure, media placement, and export easier to maintain

Remotion - treats video as React components rendered at known frame numbers

HyperFrames - uses an editable HTML composition with explicit timing and seekable animation runtimes

Neither is automatically "better"

Use the smallest system that supports the film you intend to make again

The non-negotiable requirement is seekability

 

That means no hidden clock, no unseeded randomness, and no animation that only works after a browser has been running for eight seconds

Think of every frame as a deterministic query

 

Once the film works this way, revisions become local and testable

 

# 5. Make motion have weight

Basic motion moves from A to B on a fixed curve

Good motion communicates mass, hierarchy, and intent

Small control can snap

Large panel can settle

Camera can move slowly enough to preserve orientation

Headline can arrive fast, then hold long enough to be read

Springs are useful because they describe that behavior more naturally than a generic ease-in-out

But do not turn every object into a spring

If everything overshoots, nothing feels precise

Write a motion rule for each class of object

 

The most important check is still visual

Does the viewer know where to look after each move?

If not, the animation is decoration competing with the message

 

# 6. Put sound on the same timeline

Many AI-made films look finished with the audio muted

Then you turn the sound on and realize nothing is connected

The click lands after the button

The cut misses the beat

The final logo arrives before the music resolves

Treat sound as a timeline input, not a last-minute file dropped under the video

 

Use a licensed or original track when you have one. Measure its beats and cut against them

If the sound is synthesized, place every cue against the same timestamps that drive the picture

The test is simple

Close your eyes and listen to the film

If it has no shape without the picture, the sound design is probably not finished

 

# 7. Inspect the frames before exporting the film

This is the step people skip because the first render feels like progress

Do not start by watching a full 60-second export ten times

Ask the renderer for a contact sheet

Take one frame at every major beat, then a short strip around the fastest transitions

Look for the things a text-only agent misses

 

Then give Opus the contact sheet and a specific critique task

 

 

This is the difference between "the agent made a video" and "the agent directed a video"

The first one stops when the file exists

The second stops when the evidence says the film works

 

# 8. Export variants from the source, not from a crop

A 16:9 launch film and a 9:16 social cut are different compositions

The vertical version may need larger type, fewer simultaneous elements, a different camera path, and a tighter story

Do not make one beautiful wide video and ask software to crop its center

Keep the same assets, timeline, and narrative states

Then define layout behavior for each format

 

Render a contact sheet for every variant

An export is not correct because the encoder finished

It is correct because the composition survived the format change

 

# 9. Package the studio, not the chat

If the only record of the film is a conversation, you do not have a production system

You have a lucky session

Keep the important decisions in files that another run can read

 

Then the next video starts with a real base

Swap the product brief and assets

Keep the render contract, review checklist, and delivery structure

This is also how you stop a long agent run from drifting

The agent can inspect its own files, resume from a completed gate, and tell you which artifact is missing

It should not claim the film is done because the last command exited successfully

 

# 10. Give long runs gates, not freedom

The appeal of Opus is that you can hand it a large creative task and leave it working

That only helps if the run knows when to stop, when to ask, and when to repair

 

The agent can work for hours between those gates

It should not make irreversible brand decisions on your behalf

If the brief says "use the real interface" a missing interface screenshot is a blocker, not an invitation to hallucinate one

If the reference is unclear, the right output is a question or a small test frame, not 900 polished wrong frames

Autonomy becomes useful when every stage leaves evidence for the next one

That is the same lesson behind reliable agents in any domain

The loop needs a target, an observation, a bounded repair, and a way to stop

 

# The prompt I would actually give Opus

The useful prompt is not "make a viral video"

It is a production contract with review gates

 

That prompt is longer than the viral one-liner

The important part is not its length

It gives the model a sequence of decisions, artifacts, and stop conditions

You can reuse that system for the next launch instead of asking for a miracle from scratch

 

# The real shift

One-prompt video is impressive because the first result arrives fast

Motion engineering is valuable because the tenth result can be better than the first

The model gives you speed

The brief gives it direction

The renderer gives you control

The contact sheet gives you evidence

The loop turns that evidence into improvement

 

That is the difference between generating a demo and operating a studio

 

-> Subscribe to my Substack

-> Join my Telegram

-> Bookmark this this before you ask an AI to "make a video" with no brief, no references, and no way to inspect the result

-> Follow @0xwhrrari