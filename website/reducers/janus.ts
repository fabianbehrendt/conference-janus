import { Publisher, PublisherStream, SubscriberStream } from "../interfaces/janus";

interface IReducerState {
  feedStreams: { [id: number]: Publisher & { streams: { id: number; display: string; }[] } };
  subStreams: { [mid: number]: SubscriberStream; };
  localTracks: { [mid: number]: MediaStreamTrack };
  remoteTracks: { [mid: number]: MediaStreamTrack };
  remoteStreams: { [id: number]: { audio: MediaStream, video: MediaStream } };
  messages: { timestamp: string, id: number, display: string, data: string }[];
}

interface IReducerAction {
  type: "add feed stream" | "remove feed stream" | "add sub stream" | "remove sub stream" | "add local track" | "remove local track" | "add remote track" | "remove remote track" | "add remote stream" | "remove remote stream" | "add message";
  id?: number;
  display?: string;
  streams?: PublisherStream[];
  mid?: number;
  stream?: SubscriberStream;
  track?: MediaStreamTrack;
  feedId?: number;
  data?: string;
  showNotification?: () => void;
}

const reducer = (state: IReducerState, action: IReducerAction): IReducerState => {
  switch (action.type) {
    case "add feed stream":
      if (action.id == null || action.display == null || action.streams == null) {
        throw new Error("id, display or streams is missing");
      }

      const id = action.id;
      const display = action.display;
      const streams = action.streams;

      const newFeedStream = {
        id: id,
        display: display,
        streams: streams.map(stream => {
          return {
            ...stream,
            id: id,
            display: display,
          };
        }),
      };

      return {
        ...state,
        feedStreams: {
          ...state.feedStreams,
          [id]: newFeedStream,
        }
      };
    case "remove feed stream":
      if (action.id == null) {
        throw new Error("id is missing");
      }

      const { [action.id]: feedStreamToRemove, ...restFeedStreams } = state.feedStreams;

      return {
        ...state,
        feedStreams: restFeedStreams,
      };
    case "add sub stream":
      if (action.mid == null || action.stream == null) {
        throw new Error("mid and stream is missing");
      }

      return {
        ...state,
        subStreams: {
          ...state.subStreams,
          [action.mid]: action.stream,
        },
      };
    case "remove sub stream":
      // TODO ?
      return {
        ...state,
      };
    case "add local track":
      if (action.track == null) {
        throw new Error("track is missing");
      }

      const missingMid = Object.keys(state.localTracks).findIndex((key, idx) => key.toString() !== idx.toString());

      return {
        ...state,
        localTracks: {
          ...state.localTracks,
          [missingMid === -1 ? Object.keys(state.localTracks).length : missingMid]: action.track,
        }
        // localTracks: [
        //   ...state.localTracks,
        //   action.track,
        // ],
      };
    case "remove local track":
      if (action.track == null) {
        throw new Error("track is missing");
      }

      const indexOfTrack = Object.values(state.localTracks).findIndex(track => track.id === action.track?.id);

      const { [indexOfTrack]: removedTrack, ...restLocalTracks } = state.localTracks;

      return {
        ...state,
        localTracks: restLocalTracks,
        // localTracks: state.localTracks.filter(track => {
        //   if (track.id !== action.track!.id) {
        //     return true;
        //   } else {
        //     track.stop();
        //     return false;
        //   }
        // }),
      };
    case "add remote track":
      if (action.mid == null || action.track == null) {
        throw new Error("mid and track is missing");
      }

      return {
        ...state,
        remoteTracks: {
          ...state.remoteTracks,
          [action.mid]: action.track,
        }
      };
    case "remove remote track":
      if (action.mid == null) {
        throw new Error("mid is missing");
      }

      const { [action.mid]: trackToRemove, ...restRemoteTracks } = state.remoteTracks;

      trackToRemove.stop();

      return {
        ...state,
        remoteTracks: restRemoteTracks,
      };
    case "add remote stream":
      if (action.mid == null) {
        throw new Error("mid is missing");
      }

      // TODO only store relevant stream if feedId is from host -> via socket.io?
      const feedId = state.subStreams[action.mid].feed_id;
      const remoteTrack = state.remoteTracks[action.mid];

      return {
        ...state,
        remoteStreams: {
          ...state.remoteStreams,
          [feedId]: {
            ...state.remoteStreams[feedId],
            [remoteTrack.kind]: new MediaStream([remoteTrack.clone()]),
          },
        },
      };
    case "remove remote stream":
      if (action.feedId == null) {
        throw new Error("feedId is missing");
      }

      const { [action.feedId]: remoteStreamToRemove, ...restRemoteStreams } = state.remoteStreams;

      return {
        ...state,
        remoteStreams: restRemoteStreams,
      };
    case "add message":
      if (action.id == null || action.data == null) {
        throw new Error("id, data or display is missing");
      }

      action.showNotification && action.showNotification();

      return {
        ...state,
        messages: [
          ...state.messages,
          {
            timestamp: new Date().toISOString(),
            id: action.id,
            display: state.feedStreams[action.id].display,
            data: action.data,
          },
        ],
      }
    default:
      throw new Error("unknown type of dispatch operation");
  }
}

export default reducer;